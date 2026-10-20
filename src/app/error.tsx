"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto flex min-h-[60svh] max-w-md flex-col justify-center gap-5 px-6 py-12">
    <h1 className="text-2xl font-semibold">We couldn&apos;t load this page.</h1>
    <p className="text-sm leading-6 text-secondary">Please try again in a moment.</p>
    <Button onClick={() => reset()}>Try again</Button>
    <Link href="/" className="ui-link text-center text-sm">Back to home</Link>
  </main>;
}
