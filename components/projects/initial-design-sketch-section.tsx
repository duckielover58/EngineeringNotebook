"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { addProjectSketch, removeProjectSketch } from "@/actions/projects";
import { createClient } from "@/lib/supabase/client";
import { uploadProjectFile } from "@/lib/storage-upload";
import { Button } from "@/components/ui/button";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ProjectSketch } from "@/types/database";

type Props = {
  projectId: string;
  initialSketches: ProjectSketch[];
  canEdit: boolean;
};

function formatStamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString();
}

export function InitialDesignSketchSection({ projectId, initialSketches, canEdit }: Props) {
  const router = useRouter();
  const [sketches, setSketches] = useState<ProjectSketch[]>(initialSketches);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const inserted: ProjectSketch[] = [];
      for (const f of files) {
        const url = await uploadProjectFile(supabase, "sketches", projectId, f);
        const res = await addProjectSketch(projectId, "initial_design", url);
        if ("error" in res && res.error) {
          setError(res.error);
          setPending(false);
          if (inserted.length > 0) setSketches((prev) => [...prev, ...inserted]);
          return;
        }
        if ("sketch" in res && res.sketch) {
          inserted.push(res.sketch as ProjectSketch);
        }
      }
      if (inserted.length > 0) setSketches((prev) => [...prev, ...inserted]);
      setFiles([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setPending(false);
  }

  async function remove(id: string) {
    setError(null);
    setPending(true);
    const res = await removeProjectSketch(id);
    if ("error" in res && res.error) {
      setError(res.error);
    } else {
      setSketches((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    }
    setPending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Initial design sketch</CardTitle>
        <CardDescription>
          The chosen direction from the brainstorming + decision matrix. Upload polished sketches of the path forward before final comparison.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sketches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No initial design sketches yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {sketches.map((s) => (
              <div key={s.id} className="space-y-1">
                <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                  <PhotoLightbox src={s.url} alt="Initial design sketch" className="absolute inset-0 block h-full w-full">
                    <Image src={s.url} alt="Initial design sketch" fill className="object-cover" sizes="200px" />
                  </PhotoLightbox>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 z-10 h-7 px-2 bg-background/80 backdrop-blur"
                      onClick={() => remove(s.id)}
                      disabled={pending}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Uploaded {formatStamp(s.created_at)}</p>
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="space-y-2">
            <Input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={save} disabled={pending || files.length === 0}>
              {pending ? "Saving…" : "Save uploads"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
