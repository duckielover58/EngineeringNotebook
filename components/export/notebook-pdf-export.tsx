"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useRef, useState } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

import { optionTotals, winningOptionIndex } from "@/lib/matrix";
import type { GanttData } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ProjectPayload = {
  title: string;
  team_photo_url: string | null;
  initial_sketch_urls: string[];
  matrix_criteria: string[];
  matrix_options: string[];
  matrix_ratings: number[][];
  gantt_data: GanttData | null;
  technical_latex: string | null;
  final_sketch_urls: string[];
};

type LogRow = { content: string; image_urls: string[]; created_at: string };

export function NotebookPdfExport({ project, logs }: { project: ProjectPayload; logs: LogRow[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = project.matrix_ratings.length ? optionTotals(project.matrix_ratings) : [];
  const winnerIdx = totals.length ? winningOptionIndex(totals) : -1;
  const latexHtml =
    project.technical_latex &&
    katex.renderToString(project.technical_latex, { throwOnError: false, displayMode: true });

  async function downloadPdf() {
    if (!rootRef.current) return;
    setError(null);
    setPending(true);
    try {
      const canvas = await html2canvas(rootRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 36;
      const maxW = pageWidth - margin * 2;
      let y = margin;
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = imgProps.width / imgProps.height;
      let renderHeight = maxW / ratio;
      if (renderHeight > pageHeight - margin * 2) {
        renderHeight = pageHeight - margin * 2;
      }
      const renderWidth = renderHeight * ratio;
      if (renderHeight + y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.addImage(imgData, "PNG", margin, y, renderWidth, renderHeight);
      pdf.save(`${project.title.replace(/[^\w\-]+/g, "_")}-engilog.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not render PDF");
    }
    setPending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export notebook</CardTitle>
        <CardDescription>Generates a paginated PDF snapshot using html2canvas and jsPDF.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={downloadPdf} disabled={pending}>
          {pending ? "Rendering…" : "Download PDF"}
        </Button>
        <p className="text-xs text-muted-foreground">For best results, keep images reasonably sized. Very long notebooks may need multiple exports.</p>
        <div
          ref={rootRef}
          className="pointer-events-none fixed left-[-9999px] top-0 w-[794px] space-y-6 bg-white p-8 text-black"
          aria-hidden
        >
          <header>
            <h1 style={{ fontSize: 22, marginBottom: 8 }}>{project.title}</h1>
            <p style={{ fontSize: 12, color: "#444" }}>EngiLog engineering notebook export</p>
          </header>
          {project.team_photo_url && (
            <section>
              <h2 style={{ fontSize: 16, marginBottom: 8 }}>Team photo</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={project.team_photo_url} alt="" style={{ maxWidth: "100%", border: "1px solid #ddd" }} />
            </section>
          )}
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Initial sketches</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {project.initial_sketch_urls.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="" style={{ width: 200, height: 140, objectFit: "cover", border: "1px solid #ddd" }} />
              ))}
            </div>
          </section>
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Decision matrix</h2>
            {winnerIdx >= 0 && (
              <p style={{ fontSize: 12 }}>
                Winner: {project.matrix_options[winnerIdx]} (total {totals[winnerIdx]})
              </p>
            )}
          </section>
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Gantt</h2>
            <ul style={{ fontSize: 12 }}>
              {(project.gantt_data?.tasks ?? []).map((t) => (
                <li key={t.id}>
                  {t.name} — start {t.startWeek}, duration {t.durationWeeks} wk
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Technicals</h2>
            {latexHtml && <div dangerouslySetInnerHTML={{ __html: latexHtml }} />}
          </section>
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Daily logs</h2>
            {logs.map((l, i) => (
              <div key={i} style={{ marginBottom: 12, fontSize: 12 }}>
                <p style={{ fontWeight: 600 }}>{new Date(l.created_at).toLocaleString()}</p>
                <p>{l.content}</p>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {l.image_urls.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="" style={{ width: 120, height: 90, objectFit: "cover" }} />
                  ))}
                </div>
              </div>
            ))}
          </section>
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Final sketches</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {project.final_sketch_urls.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="" style={{ width: 200, height: 140, objectFit: "cover", border: "1px solid #ddd" }} />
              ))}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
