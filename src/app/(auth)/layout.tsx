import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-svh flex-col items-center justify-center px-5 py-10 sm:px-8">
    <div className="w-full max-w-sm">
      <Brand />
      <div className="mt-10">{children}</div>
      <p className="mt-10 text-center text-xs leading-6 text-secondary">Plan together. Fly together.</p>
    </div>
  </main>;
}
