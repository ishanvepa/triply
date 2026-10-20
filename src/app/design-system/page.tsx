import { notFound } from "next/navigation";
import { DesignSystemPreview } from "@/components/design-system-preview";
export const metadata = { title: "Design system", robots: { index: false, follow: false } };
export default function DesignSystemPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DesignSystemPreview />;
}
