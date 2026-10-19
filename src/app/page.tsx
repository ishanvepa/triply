import { siteConfig } from "@/config/site";

export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-4">
        <p className="text-sm font-medium text-zinc-400">Plan together. Fly together.</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {siteConfig.name}
        </h1>
        <p className="text-base leading-7 text-zinc-300">
          {siteConfig.description}
        </p>
        <p className="border-t border-zinc-800 pt-4 text-sm leading-6 text-zinc-400">
          A shared space for your next adventure. Flight planning is coming soon.
        </p>
      </div>
    </main>
  );
}
