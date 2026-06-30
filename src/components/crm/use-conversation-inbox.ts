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

      if (!silent) setLoading(true);
      const messageQuery = organizationId
        ? supabase.from("whatsapp_messages").select("*").eq("organization_id", organizationId)
        : supabase.from("whatsapp_messages").select("*");
      const conversationQuery = organizationId
        ? supabase.from("whatsapp_conversations").select("*").eq("organization_id", organizationId)
        : supabase.from("whatsapp_conversations").select("*");

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
    const realtimeFilter = organizationId ? `organization_id=eq.${organizationId}` : undefined;

    const messageChannel = supabase
      .channel(`whatsapp-messages:${organizationId ?? "all"}:${realtimeRetryKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages", filter: realtimeFilter },
        (payload) => {
          if (!mounted) return;
          const nextMessage = payload.new as WhatsAppMessage;
          if (payload.eventType !== "DELETE" && organizationId && nextMessage.organization_id !== organizationId) return;
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
      .channel(`whatsapp-conversations:${organizationId ?? "all"}:${realtimeRetryKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations", filter: realtimeFilter },
        (payload) => {
          if (!mounted) return;
          const nextConversation = payload.new as WhatsAppConversation;
          if (payload.eventType !== "DELETE" && organizationId && nextConversation.organization_id !== organizationId) return;
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
  }, [organizationId, realtimeRetryKey, refresh, supabase]);

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
