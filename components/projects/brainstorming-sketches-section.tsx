"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { addProjectSketch, removeProjectSketch, updateProjectSketchLabel } from "@/actions/projects";
import { createClient } from "@/lib/supabase/client";
import { uploadProjectFile } from "@/lib/storage-upload";
import { Button } from "@/components/ui/button";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  return d.toLocaleString();
}

type LabelStatus = "idle" | "saving" | "saved" | "error";

export function BrainstormingSketchesSection({ projectId, initialSketches, canEdit }: Props) {
  const router = useRouter();
  const [sketches, setSketches] = useState<ProjectSketch[]>(initialSketches);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-sketch in-flight label edits (typed but not yet saved) and save status.
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [labelStatus, setLabelStatus] = useState<Record<string, LabelStatus>>({});

  async function uploadFiles() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const inserted: ProjectSketch[] = [];
      for (const f of files) {
        const url = await uploadProjectFile(supabase, "sketches", projectId, f);
        const res = await addProjectSketch(projectId, "brainstorming", url);
        if ("error" in res && res.error) {
          setError(res.error);
          if (inserted.length > 0) setSketches((prev) => [...prev, ...inserted]);
          setPending(false);
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

  async function commitLabel(sketch: ProjectSketch) {
    const draft = labelDrafts[sketch.id];
    if (draft === undefined) return;
    const next = draft.trim();
    if (next === (sketch.member_label ?? "")) {
      // Nothing to do; just clear the draft so the field shows the saved value.
      setLabelDrafts((prev) => {
        const copy = { ...prev };
        delete copy[sketch.id];
        return copy;
      });
      return;
    }
    setLabelStatus((prev) => ({ ...prev, [sketch.id]: "saving" }));
    const res = await updateProjectSketchLabel(sketch.id, next);
    if ("error" in res && res.error) {
      setLabelStatus((prev) => ({ ...prev, [sketch.id]: "error" }));
      setError(res.error);
      return;
    }
    setSketches((prev) => prev.map((s) => (s.id === sketch.id ? { ...s, member_label: next || null } : s)));
    setLabelDrafts((prev) => {
      const copy = { ...prev };
      delete copy[sketch.id];
      return copy;
    });
    setLabelStatus((prev) => ({ ...prev, [sketch.id]: "saved" }));
    // Clear the "saved" hint after a moment.
    setTimeout(() => {
      setLabelStatus((prev) => {
        if (prev[sketch.id] !== "saved") return prev;
        const copy = { ...prev };
        delete copy[sketch.id];
        return copy;
      });
    }, 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brainstorming sketches</CardTitle>
        <CardDescription>Early concepts from the team. Tap a label to update who drew it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sketches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sketches on file.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {sketches.map((s) => {
              const labelValue = labelDrafts[s.id] ?? s.member_label ?? "";
              const status = labelStatus[s.id];
              return (
                <div key={s.id} className="space-y-1">
                  <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                    <PhotoLightbox src={s.url} alt="Brainstorming sketch" className="absolute inset-0 block h-full w-full">
                      <Image src={s.url} alt="Brainstorming sketch" fill className="object-cover" sizes="200px" />
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
                  {canEdit ? (
                    <div className="space-y-0.5">
                      <Input
                        value={labelValue}
                        placeholder="Drawn by (e.g. Alice)"
                        onChange={(e) =>
                          setLabelDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                        onBlur={() => commitLabel(s)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                        className="h-8 text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {status === "saving" && "Saving…"}
                        {status === "saved" && "Saved"}
                        {status === "error" && "Could not save"}
                        {!status && (
                          <>Uploaded {formatStamp(s.created_at)}</>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {s.member_label ? (
                        <>
                          Drawn by <span className="font-medium text-foreground">{s.member_label}</span>
                        </>
                      ) : (
                        <span className="italic">Unlabeled</span>
                      )}
                      {" · Uploaded "}
                      {formatStamp(s.created_at)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canEdit && (
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="brainstorm-add">Add more sketches</Label>
            <Input
              id="brainstorm-add"
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={uploadFiles} disabled={pending || files.length === 0}>
              {pending ? "Uploading…" : "Save uploads"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
