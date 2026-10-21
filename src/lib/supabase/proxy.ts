import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { getSupabaseEnvironment } from "./env";
import { AUTH_RETURN_TO_HEADER, getLoginPath, isProtectedPath } from "@/lib/auth/redirect";

export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnvironment();
  function forwardRequest() {
    const headers = new Headers(request.headers);
    headers.set(AUTH_RETURN_TO_HEADER, request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.next({ request: { headers } });
  }
  let response = forwardRequest();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // Preserve any cookies/headers from an earlier write in this request.
        const previous = response;
        response = forwardRequest();
        for (const cookie of previous.cookies.getAll()) response.cookies.set(cookie);
        for (const header of ["cache-control", "expires", "pragma"]) {
          const value = previous.headers.get(header);
          if (value) response.headers.set(header, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  // Actions independently verify the user. Let them emit Next's action redirect
  // protocol; a plain proxy redirect cannot be consumed by useActionState.
  // This marker is not authorization: pages and every protected action still
  // call requireUser(), even if a caller supplies this header themselves.
  const actionPost = request.method === "POST" && request.headers.has("next-action");
  if (isProtectedPath(request.nextUrl.pathname) && !actionPost && (error || !data?.claims?.sub)) {
    const target = new URL(getLoginPath(request.nextUrl.pathname + request.nextUrl.search), request.url);
    const redirect = NextResponse.redirect(target, request.method === "POST" ? 303 : 307);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(header);
      if (value) redirect.headers.set(header, value);
    }
    redirect.headers.set("Cache-Control", "private, no-store, max-age=0");
    return redirect;
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
