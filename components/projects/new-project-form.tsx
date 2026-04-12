"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createProject, updateProjectBasics } from "@/actions/projects";
import { createClient } from "@/lib/supabase/client";
import { uploadProjectFile } from "@/lib/storage-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewProjectForm({ classroomId }: { classroomId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
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
    const projectId = res.projectId;

    try {
      if (file) {
        const supabase = createClient();
        const url = await uploadProjectFile(supabase, "team-photos", projectId, file);
        const up = await updateProjectBasics(projectId, { team_photo_url: url });
        if ("error" in up && up.error) {
          setPending(false);
          setError(up.error);
          return;
        }
      }
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Upload failed");
      return;
    }

    setPending(false);
    router.push(`/projects/${projectId}/setup`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="title">Team / project title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Notebook title" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="photo">Team photo (optional)</Label>
        <Input id="photo" type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <p className="text-xs text-muted-foreground">JPEG or PNG works well on mobile workshop photos.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Continue to setup"}
      </Button>
    </form>
  );
}
