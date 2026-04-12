"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { addProjectComment } from "@/actions/comments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Row = { id: string; body: string; created_at: string; teacher_id: string };

export function TeacherCommentsPanel({
  projectId,
  isTeacher,
  initialComments,
}: {
  projectId: string;
  isTeacher: boolean;
  initialComments: Row[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setPending(true);
    const res = await addProjectComment(projectId, body, "overview");
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teacher feedback</CardTitle>
        <CardDescription>Sticky-note style comments for grading and coaching.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isTeacher && (
          <div className="space-y-2 rounded-md border border-dashed bg-muted/40 p-3">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Leave a note for this team…" rows={3} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
              {pending ? "Posting…" : "Post comment"}
            </Button>
          </div>
        )}
        <ul className="space-y-3">
          {initialComments.length === 0 ? (
            <li className="text-sm text-muted-foreground">No comments yet.</li>
          ) : (
            initialComments.map((c) => (
              <li key={c.id} className="rounded-md border bg-yellow-50/80 p-3 text-sm shadow-sm dark:bg-yellow-950/30">
                <p>{c.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
