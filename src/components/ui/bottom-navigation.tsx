"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui";
export type NavigationItem = { href: string; label: string; icon: string };
const defaultItems: NavigationItem[] = [
  { href: "/trips", label: "Trips", icon: "⌂" },
  { href: "/settings", label: "Account", icon: "◉" },
];
export function BottomNavigation({ items = defaultItems }: { items?: NavigationItem[] }) {
  const pathname = usePathname();
  return <nav aria-label="Main navigation" className="ui-dock">
    {items.map(item => {
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
        className={cn("flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-card px-2 py-1 text-[11px] text-accent", active ? "bg-elevated font-bold" : "hover:bg-elevated")}>
        <span aria-hidden="true" className="text-[17px] leading-5">{item.icon}</span>{item.label}
      </Link>;
    })}
  </nav>;
}
