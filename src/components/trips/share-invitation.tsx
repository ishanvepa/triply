"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/config/site";

export function ShareInvitation({ url }: { url: string }) {
  const id = useId();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"copy" | "share" | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied. Share it with your friends.");
    } catch {
      const input = document.getElementById(id);
      if (input instanceof HTMLInputElement) { input.focus(); input.select(); }
      setMessage("Select and copy the invitation link above.");
    }
  }
  async function share() {
    setBusy("share");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `Join me on ${siteConfig.name}`, text: "Let's plan a trip together.", url });
        setMessage("Share options opened.");
      } else await copy();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) await copy();
    } finally { setBusy(null); }
  }
  return <div className="space-y-3">
    <Input id={id} label="Invitation link" value={url} readOnly onFocus={event => event.currentTarget.select()}
      hint="Copy this link before leaving this page." />
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" disabled={busy !== null} loading={busy === "copy"} onClick={async () => {
        setBusy("copy"); try { await copy(); } finally { setBusy(null); }
      }}>Copy link</Button>
      <Button variant="ghost" disabled={busy !== null} loading={busy === "share"} onClick={share}>Share link</Button>
    </div>
    {message && <p role="status" className="text-sm text-accent">{message}</p>}
  </div>;
}
