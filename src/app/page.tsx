import { siteConfig } from "@/config/site";

import { ButtonLink } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-4">
        <p className="text-sm font-medium text-secondary">Plan together. Fly together.</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {siteConfig.name}
        </h1>
        <p className="text-base leading-7 text-secondary">
          {siteConfig.description}
        </p>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row">
          <ButtonLink href="/signup">Create an account</ButtonLink>
          <ButtonLink href="/login" variant="outline">Sign in</ButtonLink>
        </div>
      </div>
    </main>
  );
}
