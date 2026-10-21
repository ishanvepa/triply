"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { validateTrip, type TripFormState } from "@/lib/trips/validation";

export async function createTrip(_previous: TripFormState, formData: FormData): Promise<TripFormState> {
  await requireUser();
  const { values, fields, valid } = validateTrip(formData);
  if (!valid) return { fields, values };

  const supabase = await createClient();
  const { data, error } = await supabase.from("trips").insert({
    name: values.name, start_date: values.startDate, end_date: values.endDate,
    description: values.description || null,
    // created_by and id use database defaults. The existing insert trigger adds
    // organizer membership in the same transaction; never trust submitted IDs.
  }).select("id").single();
  if (error || !data) return { error: "We couldn't create your trip. Please try again.", values };

  revalidatePath("/trips");
  redirect(`/trips/${data.id}`);
}
