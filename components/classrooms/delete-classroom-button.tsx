"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteClassroom } from "@/actions/classrooms";
import { Button } from "@/components/ui/button";

export function DeleteClassroomButton({
  classroomId,
  classroomName,
}: {
  classroomId: string;
  classroomName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    const ok = window.confirm(
      `Delete classroom "${classroomName}"? This permanently removes the classroom, all of its notebooks, daily logs, comments, and teacher/student memberships. This cannot be undone.`,
    );
    if (!ok) return;
    setError(null);
    setPending(true);
    const res = await deleteClassroom(classroomId);
    if ("error" in res && res.error) {
      setError(res.error);
      setPending(false);
      return;
    }
    router.replace("/classrooms");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="destructive" size="sm" onClick={onClick} disabled={pending}>
        {pending ? "Deleting…" : "Delete classroom"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
