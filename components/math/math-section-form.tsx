"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { addMathImage, removeMathImage, updateProjectMath } from "@/actions/projects";
import { createClient } from "@/lib/supabase/client";
import { uploadProjectFile } from "@/lib/storage-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectMathImage } from "@/types/database";

type Props = {
  projectId: string;
  initialNotes: string | null;
  notesUpdatedAt: string | null;
  initialImages: ProjectMathImage[];
  canEdit: boolean;
};

function formatStamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

export function MathSectionForm({
  projectId,
  initialNotes,
  notesUpdatedAt,
  initialImages,
  canEdit,
}: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState<string>(initialNotes ?? "");
  const [notesStamp, setNotesStamp] = useState<string | null>(notesUpdatedAt);
  const [images, setImages] = useState<ProjectMathImage[]>(initialImages);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveNotes() {
    setError(null);
    setPending(true);
    const res = await updateProjectMath(projectId, { notes });
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if ("updatedAt" in res && res.updatedAt) {
      setNotesStamp(res.updatedAt);
    }
    router.refresh();
  }

  async function uploadImages() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const inserted: ProjectMathImage[] = [];
      for (const f of files) {
        const url = await uploadProjectFile(supabase, "sketches", projectId, f);
        const res = await addMathImage(projectId, url);
        if ("error" in res && res.error) {
          setError(res.error);
          setPending(false);
          if (inserted.length > 0) setImages((prev) => [...prev, ...inserted]);
          return;
        }
        if ("image" in res && res.image) {
          inserted.push(res.image as ProjectMathImage);
        }
      }
      if (inserted.length > 0) {
        setImages((prev) => [...prev, ...inserted]);
      }
      setFiles([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setPending(false);
  }

  async function removeImage(imageId: string) {
    setError(null);
    setPending(true);
    const res = await removeMathImage(imageId);
    if ("error" in res && res.error) {
      setError(res.error);
    } else {
      setImages((prev) => prev.filter((i) => i.id !== imageId));
      router.refresh();
    }
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reference notes</CardTitle>
          <CardDescription>
            Weights, constants, formulas, and observations the team needs while working on the math.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="math-notes" className="sr-only">
              Reference notes
            </Label>
            <Textarea
              id="math-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={8}
              placeholder={"e.g.\n- Drive motor stall torque: 0.5 N·m\n- Robot mass: 4.2 kg\n- Wheel radius: 0.04 m"}
              className="font-mono text-sm"
              disabled={!canEdit || pending}
            />
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={saveNotes} disabled={pending}>
                {pending ? "Saving…" : "Save notes"}
              </Button>
              {notesStamp && (
                <p className="text-xs text-muted-foreground">Last saved {formatStamp(notesStamp)}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {notesStamp
                ? `Last updated ${formatStamp(notesStamp)} · only project members can edit.`
                : "Only project members can edit the math section."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Math work</CardTitle>
          <CardDescription>Upload photos of paper math, free-body diagrams, derivations, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">No math images uploaded yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {images.map((img) => (
                <div key={img.id} className="space-y-1">
                  <a href={img.url} target="_blank" rel="noreferrer" className="block">
                    <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                      <Image src={img.url} alt="Math work" fill className="object-cover" sizes="200px" />
                    </div>
                  </a>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Uploaded {formatStamp(img.created_at)}</p>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => removeImage(img.id)}
                        disabled={pending}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="space-y-2">
              <Label htmlFor="math-files">Add images</Label>
              <Input
                id="math-files"
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <Button onClick={uploadImages} disabled={pending || files.length === 0}>
                {pending ? "Uploading…" : "Save uploads"}
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
