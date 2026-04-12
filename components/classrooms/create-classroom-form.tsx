"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClassroom } from "@/actions/classrooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateClassroomForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await createClassroom(fd);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if ("ok" in res && res.ok) {
      router.push(`/classrooms/${res.classroomId}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="name">Classroom name</Label>
        <Input id="name" name="name" required placeholder="e.g. Period 3 Robotics" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create & get join code"}
      </Button>
    </form>
  );
}
