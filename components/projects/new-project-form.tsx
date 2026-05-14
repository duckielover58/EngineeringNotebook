"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewProjectForm({ classroomId }: { classroomId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await createProject(classroomId, title);
    if ("error" in res && res.error) {
      setPending(false);
      setError(res.error);
      return;
    }
    if (!("ok" in res && res.ok)) {
      setPending(false);
      return;
    }
    setPending(false);
    router.push(`/projects/${res.projectId}/setup`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="title">Project title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Solar oven prototype" />
        <p className="text-xs text-muted-foreground">
          Your name is added automatically to the notebook title. You can add a cover photo and details on the next step.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Continue to setup"}
      </Button>
    </form>
  );
}
