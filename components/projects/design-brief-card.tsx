"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { updateDesignBrief } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DesignBrief } from "@/types/database";

const EMPTY_BRIEF: DesignBrief = {
  client: "",
  target_consumer: "",
  design_team: "",
  design_statement: "",
  criteria: [],
  deliverables: [],
};

function formatStamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

export function normalizeBrief(input: DesignBrief | null | undefined): DesignBrief {
  return {
    client: input?.client ?? "",
    target_consumer: input?.target_consumer ?? "",
    design_team: input?.design_team ?? "",
    design_statement: input?.design_statement ?? "",
    criteria: Array.isArray(input?.criteria) ? input!.criteria : [],
    deliverables: Array.isArray(input?.deliverables) ? input!.deliverables : [],
  };
}

/** Reusable form body for the brief; caller renders the action buttons. */
export function DesignBriefForm({
  projectId,
  initial,
  designProblem,
  onSavedAction,
  busyExternally,
  actionsSlot,
}: {
  projectId: string;
  initial: DesignBrief;
  /** Read-only display value for the "Problem Or Need" cell, sourced from projects.design_problem. */
  designProblem: string | null;
  onSavedAction: (saved: DesignBrief, updatedAt: string) => void;
  busyExternally?: boolean;
  actionsSlot: (ctx: { save: () => Promise<boolean>; pending: boolean }) => ReactNode;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DesignBrief>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof DesignBrief>(key: K, value: DesignBrief[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function setListItem(key: "criteria" | "deliverables", index: number, value: string) {
    setDraft((prev) => {
      const next = [...prev[key]];
      next[index] = value;
      return { ...prev, [key]: next };
    });
  }

  function addListItem(key: "criteria" | "deliverables") {
    setDraft((prev) => ({ ...prev, [key]: [...prev[key], ""] }));
  }

  function removeListItem(key: "criteria" | "deliverables", index: number) {
    setDraft((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  }

  async function save(): Promise<boolean> {
    setError(null);
    setPending(true);
    const res = await updateDesignBrief(projectId, draft);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return false;
    }
    if ("brief" in res && res.brief && "updatedAt" in res && typeof res.updatedAt === "string") {
      onSavedAction(res.brief as DesignBrief, res.updatedAt);
      setDraft(res.brief as DesignBrief);
    }
    router.refresh();
    return true;
  }

  const busy = pending || !!busyExternally;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            <Row label="Client">
              <Input
                value={draft.client}
                onChange={(e) => setField("client", e.target.value)}
                placeholder="e.g. Ms. Wheaton"
                disabled={busy}
              />
            </Row>
            <Row label="Target Consumer">
              <Input
                value={draft.target_consumer}
                onChange={(e) => setField("target_consumer", e.target.value)}
                placeholder="e.g. Everybody on the planet!"
                disabled={busy}
              />
            </Row>
            <Row label="Design Team">
              <Input
                value={draft.design_team}
                onChange={(e) => setField("design_team", e.target.value)}
                placeholder="Team member names"
                disabled={busy}
              />
            </Row>
            <Row label={'"Problem" Or Need'}>
              <div className="space-y-1">
                <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-sm text-muted-foreground">
                  {designProblem?.trim() || (
                    <span className="italic">
                      Set the design problem on the title page; it appears here automatically.
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  This row mirrors the title page&apos;s design problem. Edit it there to change this value.
                </p>
              </div>
            </Row>
            <Row label="Design Statement">
              <Textarea
                rows={2}
                value={draft.design_statement}
                onChange={(e) => setField("design_statement", e.target.value)}
                placeholder="A short statement describing what your team will build."
                disabled={busy}
              />
            </Row>
            <Row label="Criteria">
              <ListEditor
                items={draft.criteria}
                onChangeItem={(i, v) => setListItem("criteria", i, v)}
                onAdd={() => addListItem("criteria")}
                onRemove={(i) => removeListItem("criteria", i)}
                placeholder="e.g. Must be powered by solar power"
                disabled={busy}
              />
            </Row>
            <Row label="Deliverables">
              <ListEditor
                items={draft.deliverables}
                onChangeItem={(i, v) => setListItem("deliverables", i, v)}
                onAdd={() => addListItem("deliverables")}
                onRemove={(i) => removeListItem("deliverables", i)}
                placeholder={`e.g. "Straightness" of the travel`}
                disabled={busy}
              />
            </Row>
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">{actionsSlot({ save, pending })}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="align-top">
      <th scope="row" className="w-44 bg-muted/40 p-3 text-left text-sm font-medium">
        {label}
      </th>
      <td className="p-3">{children}</td>
    </tr>
  );
}

function ListEditor({
  items,
  onChangeItem,
  onAdd,
  onRemove,
  placeholder,
  disabled,
}: {
  items: string[];
  onChangeItem: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">No entries yet.</p>
      )}
      <ul className="space-y-2">
        {items.map((value, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground" aria-hidden>•</span>
            <Input
              value={value}
              onChange={(e) => onChangeItem(i, e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(i)} disabled={disabled}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={onAdd} disabled={disabled}>
        Add row
      </Button>
    </div>
  );
}

function DesignBriefView({
  brief,
  designProblem,
}: {
  brief: DesignBrief;
  designProblem: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <tbody className="divide-y">
          <ViewRow label="Design Brief"><span className="text-muted-foreground">Project specification</span></ViewRow>
          <ViewRow label="Client">{brief.client || <em className="text-muted-foreground">—</em>}</ViewRow>
          <ViewRow label="Target Consumer">{brief.target_consumer || <em className="text-muted-foreground">—</em>}</ViewRow>
          <ViewRow label="Design Team">{brief.design_team || <em className="text-muted-foreground">—</em>}</ViewRow>
          <ViewRow label={'"Problem" Or Need'}>
            {designProblem?.trim() ? (
              <p className="whitespace-pre-wrap">{designProblem}</p>
            ) : (
              <em className="text-muted-foreground">Set on the title page.</em>
            )}
          </ViewRow>
          <ViewRow label="Design Statement">{brief.design_statement || <em className="text-muted-foreground">—</em>}</ViewRow>
          <ViewRow label="Criteria">
            {brief.criteria.length === 0 ? (
              <em className="text-muted-foreground">—</em>
            ) : (
              <ul className="list-inside list-disc space-y-0.5">
                {brief.criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
          </ViewRow>
          <ViewRow label="Deliverables">
            {brief.deliverables.length === 0 ? (
              <em className="text-muted-foreground">—</em>
            ) : (
              <ul className="list-inside list-disc space-y-0.5">
                {brief.deliverables.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </ViewRow>
        </tbody>
      </table>
    </div>
  );
}

function ViewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="align-top">
      <th scope="row" className="w-44 bg-muted/40 p-3 text-left text-sm font-medium">
        {label}
      </th>
      <td className="p-3 text-sm">{children}</td>
    </tr>
  );
}

export function DesignBriefCard({
  projectId,
  initial,
  designProblem,
  initialUpdatedAt,
  canEdit,
}: {
  projectId: string;
  initial: DesignBrief | null;
  designProblem: string | null;
  initialUpdatedAt: string | null;
  canEdit: boolean;
}) {
  const [brief, setBrief] = useState<DesignBrief>(normalizeBrief(initial ?? EMPTY_BRIEF));
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Design brief</CardTitle>
          <CardDescription>
            {updatedAt
              ? `Last updated ${formatStamp(updatedAt)}`
              : "Specification of the team's design problem."}
            {!canEdit && <> · Only project members can edit.</>}
          </CardDescription>
        </div>
        {canEdit && !editing && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <DesignBriefForm
            projectId={projectId}
            initial={brief}
            designProblem={designProblem}
            onSavedAction={(saved, savedAt) => {
              setBrief(saved);
              setUpdatedAt(savedAt);
              setEditing(false);
            }}
            actionsSlot={({ save, pending }) => (
              <>
                <Button type="button" onClick={save} disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
                  Cancel
                </Button>
              </>
            )}
          />
        ) : (
          <DesignBriefView brief={brief} designProblem={designProblem} />
        )}
      </CardContent>
    </Card>
  );
}
