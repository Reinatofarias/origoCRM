"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  applyConversationRealtimeEvent,
  applyMessageRealtimeEvent,
} from "@/components/crm/conversation-state";
import { createSupabaseClient } from "@/lib/db";
import type { WhatsAppConversation, WhatsAppMessage } from "@/lib/types";

export type ConversationRealtimeStatus = "connecting" | "connected" | "fallback" | "disabled";

const MESSAGE_HISTORY_LIMIT = 2_000;
const CONVERSATION_LIMIT = 500;

export function useConversationInbox(organizationId: string | null, selectedPhone: string | null) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [storedConversations, setStoredConversations] = useState<WhatsAppConversation[]>([]);
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [readPhones, setReadPhones] = useState<Set<string>>(() => new Set());
  const [realtimeStatus, setRealtimeStatus] = useState<ConversationRealtimeStatus>(
    supabase ? "connecting" : "disabled",
  );
  const [realtimeRetryKey, setRealtimeRetryKey] = useState(0);
  const selectedPhoneRef = useRef<string | null>(selectedPhone);

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  const refresh = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      if (!organizationId) {
        setMessages([]);
        setStoredConversations([]);
        setCurrentInstanceId(null);
        setRealtimeStatus("disabled");
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      let instanceId: string | null = null;
      const { data: instanceData } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("provider", "evolution")
        .maybeSingle();
      instanceId = typeof instanceData?.id === "string" ? instanceData.id : null;
      setCurrentInstanceId(instanceId);

      let messageQuery = supabase.from("whatsapp_messages").select("*").eq("organization_id", organizationId);
      let conversationQuery = supabase.from("whatsapp_conversations").select("*").eq("organization_id", organizationId);

      if (instanceId) {
        messageQuery = messageQuery.eq("whatsapp_instance_id", instanceId);
        conversationQuery = conversationQuery.eq("whatsapp_instance_id", instanceId);
      }

      const [messageResult, conversationResult] = await Promise.all([
        messageQuery.order("created_at", { ascending: false }).limit(MESSAGE_HISTORY_LIMIT),
        conversationQuery.order("updated_at", { ascending: false }).limit(CONVERSATION_LIMIT),
      ]);

      if (!messageResult.error) {
        const recentMessages = (messageResult.data as WhatsAppMessage[] | null) ?? [];
        setMessages(recentMessages.reverse());
      }
      if (!conversationResult.error) {
        setStoredConversations((conversationResult.data as WhatsAppConversation[] | null) ?? []);
      }
      if (messageResult.error || conversationResult.error) setRealtimeStatus("fallback");
      setLoading(false);
    },
    [organizationId, supabase],
  );

  useEffect(() => {
    if (!supabase) return;
    if (!organizationId) return;

    let mounted = true;
    let reconnectTimer: number | null = null;
    const ready = { messages: false, conversations: false };

    queueMicrotask(() => {
      if (mounted) {
        setRealtimeStatus("connecting");
        void refresh();
      }
    });

    const scheduleReconnect = () => {
      if (reconnectTimer || !mounted) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        if (mounted) setRealtimeRetryKey((current) => current + 1);
      }, 5_000);
    };
    const updateChannelStatus = (
      channel: keyof typeof ready,
      status: "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED",
    ) => {
      if (!mounted) return;
      if (status === "SUBSCRIBED") {
        ready[channel] = true;
        if (ready.messages && ready.conversations) setRealtimeStatus("connected");
        return;
      }

      ready[channel] = false;
      setRealtimeStatus("fallback");
      scheduleReconnect();
    };
    const realtimeFilter = `organization_id=eq.${organizationId}`;

    const messageChannel = supabase
      .channel(`whatsapp-messages:${organizationId}:${realtimeRetryKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages", filter: realtimeFilter },
        (payload) => {
          if (!mounted) return;
          const nextMessage = payload.new as WhatsAppMessage;
          if (payload.eventType !== "DELETE" && organizationId && nextMessage.organization_id !== organizationId) return;
          if (payload.eventType !== "DELETE" && currentInstanceId && nextMessage.whatsapp_instance_id !== currentInstanceId) return;
          if (
            payload.eventType === "INSERT" &&
            nextMessage.direction === "inbound" &&
            nextMessage.phone_number !== selectedPhoneRef.current
          ) {
            setReadPhones((current) => {
              if (!current.has(nextMessage.phone_number)) return current;
              const next = new Set(current);
              next.delete(nextMessage.phone_number);
              return next;
            });
          }
          setMessages((current) => applyMessageRealtimeEvent(current, payload));
        },
      )
      .subscribe((status) => updateChannelStatus("messages", status));

    const conversationChannel = supabase
      .channel(`whatsapp-conversations:${organizationId}:${realtimeRetryKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations", filter: realtimeFilter },
        (payload) => {
          if (!mounted) return;
          const nextConversation = payload.new as WhatsAppConversation;
          if (payload.eventType !== "DELETE" && organizationId && nextConversation.organization_id !== organizationId) return;
          if (payload.eventType !== "DELETE" && currentInstanceId && nextConversation.whatsapp_instance_id !== currentInstanceId) return;
          setStoredConversations((current) => applyConversationRealtimeEvent(current, payload));
        },
      )
      .subscribe((status) => updateChannelStatus("conversations", status));

    return () => {
      mounted = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      void supabase.removeChannel(messageChannel);
      void supabase.removeChannel(conversationChannel);
    };
  }, [currentInstanceId, organizationId, realtimeRetryKey, refresh, supabase]);

  useEffect(() => {
    if (!supabase) return;

    const poll = window.setInterval(() => {
      if (realtimeStatus !== "connected") void refresh({ silent: true });
    }, 15_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh({ silent: true });
    };
    const reconnectWhenOnline = () => {
      setRealtimeStatus("connecting");
      setRealtimeRetryKey((current) => current + 1);
      void refresh({ silent: true });
    };
    const markOffline = () => setRealtimeStatus("fallback");

    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", reconnectWhenOnline);
    window.addEventListener("offline", markOffline);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", reconnectWhenOnline);
      window.removeEventListener("offline", markOffline);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [realtimeStatus, refresh, supabase]);

  return {
    loading,
    messages,
    readPhones,
    realtimeStatus,
    refresh,
    setMessages,
    setReadPhones,
    setStoredConversations,
    storedConversations,
  };
}
