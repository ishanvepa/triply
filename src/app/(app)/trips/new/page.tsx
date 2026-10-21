import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { CreateTripForm } from "@/components/trips/create-trip-form";

export const metadata = { title: "New trip" };
export default async function NewTripPage() {
  await requireUser();
  return <div className="max-w-xl">
    <PageHeader title="New trip" backHref="/trips" description="Make room for the next adventure." />
    <Card><CreateTripForm /></Card>
  </div>;
}
