"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { updateProjectTechnicals } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function LatexTechnicalsForm({ projectId, initial }: { projectId: string; initial: string | null }) {
  const router = useRouter();
  const [latex, setLatex] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const previewHtml = useMemo(() => {
    try {
      return katex.renderToString(latex || "\\text{Preview}", {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return "";
    }
  }, [latex]);

  async function save() {
    setError(null);
    setPending(true);
    const res = await updateProjectTechnicals(projectId, latex);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Enter LaTeX math for calculations and derivations.</p>
        <Textarea value={latex} onChange={(e) => setLatex(e.target.value)} rows={14} className="font-mono text-sm" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save technicals"}
        </Button>
      </div>
      <div className="space-y-2 rounded-md border bg-card p-4">
        <p className="text-sm font-medium">Preview</p>
        <div className="min-h-[200px] overflow-x-auto rounded-md bg-muted/40 p-4" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>
    </div>
  );
}
