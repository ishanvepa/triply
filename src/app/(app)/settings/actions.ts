"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "@/lib/auth/validation";

export async function updateProfile(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const user = await requireUser();
  const value = formData.get("fullName");
  const displayName = typeof value === "string" ? value.trim() : "";
  if (!displayName || displayName.length > 80) return {
    fields: { fullName: "Enter a name with 1–80 characters." }, values: { fullName: displayName },
  };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: displayName })
    .eq("id", user.id).select("id").single();
  if (error) return { error: "We couldn't save your name. Please try again.", values: { fullName: displayName } };
  revalidatePath("/settings");
  return { success: "Your name has been saved.", values: { fullName: displayName } };
}
