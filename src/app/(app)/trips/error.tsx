"use client";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorMessage } from "@/components/ui/error-message";
import { Button } from "@/components/ui/button";

export default function TripsError({ retry }: { retry: () => void }) {
  return <div>
    <PageHeader title="Your trips" description="Plan together. Decide together." />
    <ErrorMessage action={<Button variant="outline" onClick={retry}>Try again</Button>}>
      We couldn&apos;t load your trips. Please try again.
    </ErrorMessage>
  </div>;
}
