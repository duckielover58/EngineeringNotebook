"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";

export function DeleteProjectButton({
  projectId,
  projectTitle,
  classroomId,
}: {
  projectId: string;
  projectTitle: string;
  classroomId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    const ok = window.confirm(
      `Delete notebook "${projectTitle}"? This permanently removes the notebook and all of its sketches, matrix data, Gantt chart, daily logs, math work, and comments. This cannot be undone.`,
    );
    if (!ok) return;
    setError(null);
    setPending(true);
    const res = await deleteProject(projectId);
    if ("error" in res && res.error) {
      setError(res.error);
      setPending(false);
      return;
    }
    router.replace(classroomId ? `/classrooms/${classroomId}` : "/classrooms");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="destructive" size="sm" onClick={onClick} disabled={pending}>
        {pending ? "Deleting…" : "Delete notebook"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
