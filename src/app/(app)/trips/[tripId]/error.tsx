"use client";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorMessage } from "@/components/ui/error-message";
import { Button, ButtonLink } from "@/components/ui/button";

export default function DashboardError({ retry }: { retry: () => void }) {
  return <div className="space-y-6">
    <PageHeader title="Trip planning unavailable" />
    <ErrorMessage action={<Button variant="outline" onClick={retry}>Try again</Button>}>
      We couldn&apos;t load this trip&apos;s planning details. Please try again.
    </ErrorMessage>
    <ButtonLink href="/trips" variant="ghost">Back to trips</ButtonLink>
  </div>;
}
