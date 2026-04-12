"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateFinalSketches } from "@/actions/projects";
import { createClient } from "@/lib/supabase/client";
import { uploadProjectFile } from "@/lib/storage-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function FinalSketchesForm({ projectId, initialUrls }: { projectId: string; initialUrls: string[] }) {
  const router = useRouter();
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const next = [...urls];
      for (const f of files) {
        next.push(await uploadProjectFile(supabase, "sketches", projectId, f));
      }
      const res = await updateFinalSketches(projectId, next);
      if ("error" in res && res.error) {
        setError(res.error);
        setPending(false);
        return;
      }
      setUrls(next);
      setFiles([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setPending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Final design sketches</CardTitle>
        <CardDescription>Compare and document your final concept photos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="file" accept="image/*" multiple capture="environment" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        <div className="grid gap-3 sm:grid-cols-3">
          {urls.map((u) => (
            <div key={u} className="relative aspect-video overflow-hidden rounded-md border bg-muted">
              <Image src={u} alt="Final sketch" fill className="object-cover" sizes="200px" />
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save uploads"}
        </Button>
      </CardContent>
    </Card>
  );
}
