import "server-only";

import crypto from "node:crypto";

import type { Lead, Task } from "@/lib/types";
import type { createSupabaseServerClient } from "@/lib/server/supabase";

type GenericSupabaseClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

type GoogleCalendarConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  appUrl: string;
};

type GoogleCalendarConnection = {
  id: string;
  organization_id?: string | null;
  user_id: string;
  account_email?: string | null;
  calendar_id?: string | null;
  refresh_token_encrypted?: string | null;
  scopes?: string[] | null;
  status: "connected" | "disconnected" | "error";
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleEventResponse = {
  id?: string;
  htmlLink?: string;
  error?: {
    message?: string;
  };
};

export function getGoogleCalendarConfig(): GoogleCalendarConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  const scopes = process.env.GOOGLE_CALENDAR_SCOPES || "https://www.googleapis.com/auth/calendar.events";
  const appUrl = process.env.APP_URL || "https://origocrm.vercel.app";

  if (!clientId || !clientSecret || !redirectUri) return null;

  return { clientId, clientSecret, redirectUri, scopes, appUrl };
}

export function buildGoogleCalendarAuthorizationUrl(state: string) {
  const config = getGoogleCalendarConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAuthorizationCode(code: string) {
  const config = getGoogleCalendarConfig();
  if (!config) throw new Error("Google Calendar nao configurado");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const data = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || "Nao foi possivel conectar o Google Calendar");
  }

  return data;
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const config = getGoogleCalendarConfig();
  if (!config) throw new Error("Google Calendar nao configurado");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const data = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || "Nao foi possivel atualizar acesso ao Google Calendar");
  }

  return data.access_token;
}

export async function revokeGoogleRefreshToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
    cache: "no-store",
  });

  return response.ok;
}

function getEncryptionKey() {
  const source = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.GOOGLE_CLIENT_SECRET;
  if (!source) throw new Error("Chave de criptografia Google ausente");
  return crypto.createHash("sha256").update(source).digest();
}

export function encryptGoogleToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptGoogleToken(value: string) {
  if (!value.startsWith("v1:")) return value;

  const [, ivValue, tagValue, encryptedValue] = value.split(":");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Token Google invalido");

  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getTaskCalendarTitle(task: Pick<Task, "title" | "type">, lead?: Pick<Lead, "name"> | null) {
  if (task.title?.trim()) return task.title.trim();
  if (lead?.name) return `Follow-up com ${lead.name}`;
  return "Tarefa OrigoCRM";
}

function buildGoogleEvent(task: Pick<Task, "title" | "type" | "notes" | "due_at">, lead?: Lead | null) {
  const start = new Date(task.due_at);
  if (Number.isNaN(start.getTime())) throw new Error("Data da tarefa invalida");

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);

  const description = [
    task.notes?.replace(/\s*\[\[repeat:(none|daily|weekly|monthly)\]\]\s*/g, "").trim(),
    lead ? `Lead: ${lead.name}` : null,
    lead?.phone ? `Telefone: ${lead.phone}` : null,
    lead?.company ? `Empresa: ${lead.company}` : null,
    "Criado pelo OrigoCRM.",
  ].filter(Boolean).join("\n");

  return {
    summary: getTaskCalendarTitle(task, lead),
    description,
    start: {
      dateTime: start.toISOString(),
      timeZone: "America/Fortaleza",
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: "America/Fortaleza",
    },
    reminders: {
      useDefault: true,
    },
  };
}

async function getConnection(
  supabase: GenericSupabaseClient,
  userId: string,
  organizationId?: string | null,
) {
  let query = supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "connected")
    .limit(1);

  query = organizationId ? query.eq("organization_id", organizationId) : query.is("organization_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) return null;
  return data as GoogleCalendarConnection | null;
}

async function updateTaskGoogleFields(
  supabase: GenericSupabaseClient,
  taskId: string,
  userId: string,
  organizationId: string | null | undefined,
  values: Record<string, string | null>,
) {
  let query = supabase
    .from("tasks")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", taskId);

  query = organizationId ? query.eq("organization_id", organizationId) : query.eq("user_id", userId);

  await query;
}

export async function syncTaskToGoogleCalendar(input: {
  supabase: GenericSupabaseClient;
  userId: string;
  organizationId?: string | null;
  task: Task;
  lead?: Lead | null;
}) {
  const config = getGoogleCalendarConfig();
  if (!config) return { synced: false, reason: "missing_config" };

  try {
    const connection = await getConnection(input.supabase, input.userId, input.organizationId);
    if (!connection?.refresh_token_encrypted) return { synced: false, reason: "not_connected" };

    const refreshToken = decryptGoogleToken(connection.refresh_token_encrypted);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    const calendarId = connection.calendar_id || "primary";
    const event = buildGoogleEvent(input.task, input.lead);
    const eventId = input.task.google_event_id;
    const endpoint = eventId
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const response = await fetch(endpoint, {
      method: eventId ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
      cache: "no-store",
    });
    const data = (await response.json()) as GoogleEventResponse;

    if (!response.ok || data.error || !data.id) {
      throw new Error(data.error?.message || "Nao foi possivel sincronizar evento no Google Calendar");
    }

    await updateTaskGoogleFields(input.supabase, input.task.id, input.userId, input.organizationId, {
      google_event_id: data.id,
      google_calendar_id: calendarId,
      google_synced_at: new Date().toISOString(),
      google_sync_error: null,
    });

    return { synced: true, eventId: data.id, htmlLink: data.htmlLink };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao sincronizar Google Calendar";
    await updateTaskGoogleFields(input.supabase, input.task.id, input.userId, input.organizationId, {
      google_sync_error: message,
    }).catch(() => undefined);
    return { synced: false, reason: message };
  }
}

export async function deleteTaskFromGoogleCalendar(input: {
  supabase: GenericSupabaseClient;
  userId: string;
  organizationId?: string | null;
  task: Pick<Task, "id" | "google_event_id" | "google_calendar_id">;
}) {
  const config = getGoogleCalendarConfig();
  if (!config || !input.task.google_event_id) return { deleted: false };

  try {
    const connection = await getConnection(input.supabase, input.userId, input.organizationId);
    if (!connection?.refresh_token_encrypted) return { deleted: false };

    const accessToken = await refreshGoogleAccessToken(decryptGoogleToken(connection.refresh_token_encrypted));
    const calendarId = input.task.google_calendar_id || connection.calendar_id || "primary";
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.task.google_event_id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );

    return { deleted: response.ok || response.status === 410 || response.status === 404 };
  } catch {
    return { deleted: false };
  }
}
