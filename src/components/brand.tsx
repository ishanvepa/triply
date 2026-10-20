import Link from "next/link";
import { siteConfig } from "@/config/site";
export function Brand() {
  return <Link href="/" className="ui-link inline-flex items-center gap-3 text-2xl font-bold no-underline">
    <span aria-hidden="true">✈</span>{siteConfig.name}
  </Link>;
}
