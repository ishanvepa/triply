"use client";
import { useState, useSyncExternalStore } from "react";
import { Brand } from "./brand";
import { Avatar } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { BottomNavigation } from "./ui/bottom-navigation";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { EmptyState } from "./ui/empty-state";
import { ErrorMessage } from "./ui/error-message";
import { Input } from "./ui/input";
import { LoadingState } from "./ui/loading-state";
import { Modal } from "./ui/modal";
import { PageHeader } from "./ui/page-header";
import { Select } from "./ui/select";

const subscribe = () => () => {};
export function DesignSystemPreview() {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  return <div className="min-h-svh">
    <div className="bg-brand-strip"><div className="mx-auto flex min-h-[100px] max-w-3xl items-center px-[22px] sm:px-8"><Brand /></div></div>
    <main className="app-content mx-auto max-w-3xl space-y-6 px-[18px] pt-8 sm:px-8">
      <PageHeader title="Design system" description="Components, colors, and interaction states." />
      <section aria-labelledby="tokens-title">
        <h2 id="tokens-title" className="mb-3 text-base font-bold">Foundations</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Background", "bg-background"], ["Card surface", "bg-surface"], ["Elevated", "bg-elevated"], ["Accent", "bg-accent"],
            ["Primary text", "bg-foreground"], ["Secondary text", "bg-secondary"], ["Success", "bg-success"], ["Warning", "bg-warning"],
          ].map(([label, color]) => <div key={label} className="rounded-card border border-border p-3"><div className={`mb-3 h-8 rounded-lg ${color}`} /><p className="text-xs text-secondary">{label}</p></div>)}
        </div>
      </section>
      <Card><h2 className="mb-4 text-base font-bold">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button disabled={!ready} onClick={() => setOpen(true)}>Open dialog</Button>
          <Button disabled={!ready} variant="outline" onClick={() => setFeedback("Outline action selected.")}>Outline action</Button>
          <Button disabled={!ready} variant="ghost" onClick={() => setFeedback("Text action selected.")}>Text action →</Button>
          <Button disabled>Disabled</Button><Button loading>Saving…</Button>
        </div>
        {feedback && <p role="status" className="mt-4 text-sm text-success">{feedback}</p>}
      </Card>
      <Card><h2 className="mb-5 text-base font-bold">Form controls</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input id="preview-name" label="Traveler name" placeholder="Your name" hint="Use the name your group knows." />
          <Select id="preview-select" label="Display preference" defaultValue="compact"><option value="compact">Compact</option><option value="comfortable">Comfortable</option></Select>
          <Input id="preview-invalid" label="Field with an error" defaultValue="" error="Please enter a value." />
          <Input id="preview-disabled" label="Disabled field" defaultValue="Unavailable" disabled />
        </div>
      </Card>
      <Card elevated><h2 className="mb-4 text-base font-bold">People and status</h2>
        <div className="mb-5 flex items-center gap-3"><Avatar name="Alex Morgan" size="sm" /><Avatar name="Sam" /><Avatar name="Taylor Lee" size="lg" /></div>
        <div className="flex flex-wrap gap-2"><Badge>Neutral</Badge><Badge tone="accent">Proposed</Badge><Badge tone="success">✓ Selected</Badge><Badge tone="warning">Needs options</Badge><Badge tone="danger">Unavailable</Badge></div>
      </Card>
      <EmptyState title="Nothing here yet" description="Your next adventure starts with a shared idea." />
      <Card><LoadingState label="Loading preview…" /></Card>
      <ErrorMessage action={<Button variant="outline" onClick={() => setFeedback("Retry action selected.")}>Try again</Button>}>An example error. Please try again.</ErrorMessage>
      <Modal open={open} onClose={() => setOpen(false)} title="A little room to focus" description="Review the details before continuing.">
        <div className="space-y-5"><Input id="dialog-name" label="Your name" /><Button onClick={() => { setFeedback("Dialog saved."); setOpen(false); }}>Save preview</Button></div>
      </Modal>
    </main>
    <BottomNavigation items={[{ href: "/design-system", label: "Components", icon: "⌂" }, { href: "/login", label: "Sign in", icon: "◉" }]} />
  </div>;
}
