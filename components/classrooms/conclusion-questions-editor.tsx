"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { setClassroomConclusionQuestions } from "@/actions/classrooms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ConclusionQuestion } from "@/types/database";

type Draft = { id?: string; prompt: string };

export function ConclusionQuestionsEditor({
  classroomId,
  initialQuestions,
}: {
  classroomId: string;
  initialQuestions: ConclusionQuestion[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(
    initialQuestions.length > 0
      ? initialQuestions.map((q) => ({ id: q.id, prompt: q.prompt }))
      : [{ prompt: "" }],
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function update(index: number, value: string) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, prompt: value } : d)));
  }

  function addRow() {
    setDrafts((prev) => [...prev, { prompt: "" }]);
  }

  function removeRow(index: number) {
    const target = drafts[index];
    // Only confirm when removing a question that has been saved before; new
    // unsaved drafts can't have any student answers attached yet.
    if (target?.id) {
      const ok = window.confirm(
        "Remove this question? Any student answers to it across every notebook in this classroom will be deleted.",
      );
      if (!ok) return;
    }
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setDrafts((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setError(null);
    setPending(true);
    const res = await setClassroomConclusionQuestions(classroomId, drafts);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setSavedAt(new Date().toLocaleString());
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conclusion questions</CardTitle>
        <CardDescription>
          Set the conclusion prompts students will answer in every notebook in this classroom. Edits apply to all notebooks. Removing a question deletes its answers in every notebook in this class.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {drafts.map((d, i) => (
            <li key={d.id ?? `new-${i}`} className="space-y-2 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Question {i + 1}</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(i, -1)}
                    disabled={pending || i === 0}
                    aria-label={`Move question ${i + 1} up`}
                    title="Move up"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(i, 1)}
                    disabled={pending || i === drafts.length - 1}
                    aria-label={`Move question ${i + 1} down`}
                    title="Move down"
                  >
                    ↓
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(i)} disabled={pending}>
                    Remove
                  </Button>
                </div>
              </div>
              <Textarea
                value={d.prompt}
                onChange={(e) => update(i, e.target.value)}
                rows={2}
                placeholder="e.g. What did your team learn from testing? What would you change next time?"
                disabled={pending}
              />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={addRow} disabled={pending}>
            Add question
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save questions"}
          </Button>
          {savedAt && <p className="text-xs text-muted-foreground">Saved {savedAt}</p>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
