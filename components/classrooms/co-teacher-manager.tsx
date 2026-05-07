"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { addCoTeacherByEmail, removeCoTeacher } from "@/actions/classrooms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type TeacherRow = {
  teacher_id: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

export function CoTeacherManager({
  classroomId,
  ownerId,
  currentUserId,
  rows,
}: {
  classroomId: string;
  ownerId: string;
  currentUserId: string;
  rows: TeacherRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = ownerId === currentUserId;

  async function add() {
    setError(null);
    setPending(true);
    const res = await addCoTeacherByEmail(classroomId, email);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setEmail("");
    router.refresh();
  }

  async function remove(teacherId: string) {
    setError(null);
    setPending(true);
    const res = await removeCoTeacher(classroomId, teacherId);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teacher team</CardTitle>
        <CardDescription>Co-teachers can manage notebooks/comments/students. Only the owner can change this roster.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              placeholder="teacher@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button type="button" onClick={add} disabled={pending || !email.trim()}>
              {pending ? "Adding…" : "Add co-teacher"}
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <ul className="space-y-2">
          {rows.map((row) => {
            const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
            const isOwnerRow = row.teacher_id === ownerId;
            return (
              <li key={row.teacher_id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span>
                  {profile?.full_name || row.teacher_id}
                  {isOwnerRow ? " (owner)" : " (co-teacher)"}
                </span>
                {isOwner && !isOwnerRow && (
                  <Button type="button" variant="outline" size="sm" onClick={() => remove(row.teacher_id)} disabled={pending}>
                    Remove
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
