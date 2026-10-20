import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

// The starter page and static assets do not need an auth request.
export const config = {
  matcher: [
    "/trips/:path*",
    "/invite/:path*",
    "/settings/:path*",
    "/auth/:path*",
    "/login",
    "/signup",
  ],
};
