import { Brand } from "@/components/brand";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { requireUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="min-h-svh">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-card focus:bg-surface focus:p-3">Skip to content</a>
    <header className="bg-brand-strip">
      <div className="mx-auto flex min-h-[100px] max-w-3xl flex-wrap items-center justify-between gap-4 px-[22px] py-5 sm:px-8">
      <Brand />
      <LogoutButton />
      </div>
    </header>
    <main id="main-content" className="app-content mx-auto max-w-3xl px-[18px] pt-8 sm:px-8 sm:pt-12">{children}</main>
    <BottomNavigation />
  </div>;
}
