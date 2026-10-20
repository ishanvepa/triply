"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin, isGoogleAuthEnabled } from "@/lib/auth/config";
import { getSafeNextPath } from "@/lib/auth/redirect";
import { getAuthErrorMessage, validateCredentials, type AuthState } from "@/lib/auth/validation";

export async function login(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const input = validateCredentials(formData, false);
  const values = { email: input.email };
  if (!input.valid) return { fields: input.fields, values };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) return { error: getAuthErrorMessage(error.code), values };
  revalidatePath("/", "layout");
  redirect(getSafeNextPath(formData.get("next")));
}

export async function signup(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const input = validateCredentials(formData, true);
  const values = { email: input.email, fullName: input.fullName };
  if (!input.valid) return { fields: input.fields, values };
  const next = getSafeNextPath(formData.get("next"));
  const confirmation = new URL("/auth/confirm", getSiteOrigin());
  confirmation.searchParams.set("next", next);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName }, emailRedirectTo: confirmation.toString() },
  });
  if (error) return { error: getAuthErrorMessage(error.code), values };
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }
  // Supabase can return an obfuscated user for an already-registered email.
  // This response deliberately doesn't disclose whether an account exists.
  return { confirmationEmail: input.email, values };
}

export async function signInWithGoogle(_previous: AuthState, formData: FormData): Promise<AuthState> {
  if (!isGoogleAuthEnabled()) return { error: "Google sign-in is currently unavailable." };
  const callback = new URL("/auth/callback", getSiteOrigin());
  callback.searchParams.set("next", getSafeNextPath(formData.get("next")));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google", options: { redirectTo: callback.toString() },
  });
  if (error || !data.url) return { error: "Google sign-in is currently unavailable. Please use email." };
  redirect(data.url);
}

export async function logout(): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return { error: "We couldn't sign you out. Please try again." };
  revalidatePath("/", "layout");
  redirect("/login?message=signed-out");
}
