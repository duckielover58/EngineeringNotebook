"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { upsertConclusionAnswer } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatStamp } from "@/lib/format-stamp";
import type { ConclusionAnswer, ConclusionQuestion } from "@/types/database";

export function ConclusionSection({
  projectId,
  questions,
  initialAnswers,
  canEdit,
}: {
  projectId: string;
  questions: ConclusionQuestion[];
  initialAnswers: ConclusionAnswer[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const initialMap: Record<string, ConclusionAnswer> = Object.fromEntries(
    initialAnswers.map((a) => [a.question_id, a]),
  );
  const [answers, setAnswers] = useState<Record<string, ConclusionAnswer>>(initialMap);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(questions.map((q) => [q.id, initialMap[q.id]?.body ?? ""])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (questions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conclusion</CardTitle>
          <CardDescription>
            Your teacher hasn&apos;t added any conclusion prompts for this classroom yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  function setDraft(id: string, value: string) {
    setDrafts((prev) => ({ ...prev, [id]: value }));
  }

  async function save(questionId: string) {
    setError(null);
    setPendingId(questionId);
    const body = (drafts[questionId] ?? "").trim();
    const res = await upsertConclusionAnswer(projectId, questionId, body);
    setPendingId(null);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if ("answer" in res && res.answer) {
      setAnswers((prev) => ({ ...prev, [questionId]: res.answer as ConclusionAnswer }));
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => {
        const answer = answers[q.id];
        const draft = drafts[q.id] ?? "";
        const dirty = (answer?.body ?? "").trim() !== draft.trim();
        return (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base">
                <span className="text-muted-foreground">{idx + 1}.</span> {q.prompt}
              </CardTitle>
              {answer?.updated_at && (
                <CardDescription>Last updated {formatStamp(answer.updated_at)}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(q.id, e.target.value)}
                rows={5}
                placeholder={canEdit ? "Type your team's answer here…" : "No answer yet."}
                disabled={!canEdit || pendingId === q.id}
              />
              {canEdit && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => save(q.id)} disabled={pendingId === q.id || !dirty}>
                    {pendingId === q.id ? "Saving…" : "Save answer"}
                  </Button>
                  {answer?.updated_at && !dirty && (
                    <p className="text-xs text-muted-foreground">Saved {formatStamp(answer.updated_at)}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
