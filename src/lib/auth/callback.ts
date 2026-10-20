import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { getSupabaseEnvironment } from "@/lib/supabase/env";
import { getSafeNextPath } from "./redirect";
import { getSiteOrigin } from "./config";

export async function finishAuthentication(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = getSafeNextPath(params.get("next"));
  const { url, publishableKey } = getSupabaseEnvironment();
  const pendingCookies = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const pendingHeaders: Record<string, string> = {};
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies, headers) {
        for (const cookie of cookies) pendingCookies.set(cookie.name, cookie);
        Object.assign(pendingHeaders, headers);
      },
    },
  });
  let succeeded = false;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (!params.has("error")) {
    if (code && code.length <= 2048) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      succeeded = !error;
    } else if (tokenHash && tokenHash.length <= 2048 && (type === "email" || type === "signup")) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      succeeded = !error;
    }
  }
  const destination = succeeded ? next : `/login?${new URLSearchParams({
    error: params.get("error") === "access_denied" ? "oauth-cancelled" : "invalid-link", next,
  })}`;
  const response = NextResponse.redirect(new URL(destination, getSiteOrigin()));
  for (const { name, value, options } of pendingCookies.values()) response.cookies.set(name, value, options);
  for (const [name, value] of Object.entries(pendingHeaders)) response.headers.set(name, value);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
