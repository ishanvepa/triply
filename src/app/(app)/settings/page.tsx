import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/auth/profile-form";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Account" };
export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
  if (error || !profile) throw new Error("Unable to load your profile. Please try again.");
  return <div className="max-w-lg space-y-8">
    <PageHeader title="Your account" description="A little about you, before the next adventure." />
    <Card role="region" aria-labelledby="profile-heading">
      <div className="mb-6 flex items-center gap-3"><Avatar name={profile.display_name} /><h2 id="profile-heading" className="text-base font-bold">Profile</h2></div>
      <div className="mb-6 border-b border-border pb-6">
        <p className="text-sm font-medium text-foreground">Email address</p>
        <p className="mt-2 break-all text-sm text-secondary">{user.email}</p>
      </div>
      <ProfileForm displayName={profile.display_name} />
    </Card>
  </div>;
}
