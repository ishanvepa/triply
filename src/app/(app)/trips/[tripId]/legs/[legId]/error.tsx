"use client";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorMessage } from "@/components/ui/error-message";
import { Button, ButtonLink } from "@/components/ui/button";

export default function FlightError({ retry }: { retry: () => void }) {
  return <div className="space-y-6"><PageHeader title="Flight options unavailable" />
    <ErrorMessage action={<Button variant="outline" onClick={retry}>Try again</Button>}>We couldn&apos;t load flight options. Please try again.</ErrorMessage>
    <ButtonLink href="/trips" variant="ghost">Back to trips</ButtonLink></div>;
}
