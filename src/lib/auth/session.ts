import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_RETURN_TO_HEADER, getLoginPath } from "./redirect";

// Per-render caching only: never share one user's session between requests.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && ![400, 401, 403].includes(error.status ?? 0)) {
    throw new Error("Unable to verify your session. Please try again.");
  }
  return data.user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const requestHeaders = await headers();
    redirect(getLoginPath(requestHeaders.get(AUTH_RETURN_TO_HEADER)));
  }
  return user;
}
