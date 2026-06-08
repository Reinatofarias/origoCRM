import "server-only";

import crypto from "node:crypto";

import { createSupabaseServiceRoleClient } from "./supabase";

type RateLimitOptions = {
  request: Request;
  scope: string;
  identifier: string | null;
  limit: number;
  windowSeconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitRow = {
  key: string;
  scope: string;
  count: number;
  window_start: string;
};

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function isPayloadTooLarge(request: Request, maxBytes: number) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return false;

  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > maxBytes;
}

export function rateLimitJson(result: RateLimitResult) {
  return Response.json(
    { error: "Muitas tentativas. Aguarde alguns segundos e tente novamente." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
      },
    },
  );
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const supabase = createSupabaseServiceRoleClient();

  if (!supabase) {
    return {
      allowed: true,
      limit: options.limit,
      remaining: options.limit,
      retryAfterSeconds: 0,
    };
  }

  const now = new Date();
  const key = hashRateLimitKey([
    options.scope,
    options.identifier || "anonymous",
    getClientIp(options.request),
  ]);

  const { data, error } = await supabase
    .from("security_rate_limits")
    .select("key,scope,count,window_start")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    return {
      allowed: true,
      limit: options.limit,
      remaining: options.limit,
      retryAfterSeconds: 0,
    };
  }

  const row = data as RateLimitRow | null;
  const windowStart = row?.window_start ? new Date(row.window_start) : null;
  const elapsedSeconds = windowStart ? Math.floor((now.getTime() - windowStart.getTime()) / 1000) : Infinity;
  const windowExpired = elapsedSeconds >= options.windowSeconds;

  if (!row || windowExpired) {
    await supabase.from("security_rate_limits").upsert(
      {
        key,
        scope: options.scope,
        count: 1,
        window_start: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "key" },
    );

    return {
      allowed: true,
      limit: options.limit,
      remaining: options.limit - 1,
      retryAfterSeconds: 0,
    };
  }

  const retryAfterSeconds = Math.max(1, options.windowSeconds - elapsedSeconds);
  if (row.count >= options.limit) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  const nextCount = row.count + 1;
  await supabase
    .from("security_rate_limits")
    .update({ count: nextCount, updated_at: now.toISOString() })
    .eq("key", key);

  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - nextCount),
    retryAfterSeconds,
  };
}

function hashRateLimitKey(parts: string[]) {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}
