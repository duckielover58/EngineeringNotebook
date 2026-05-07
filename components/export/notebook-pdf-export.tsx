"use client";

import { useRef, useState } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

import { optionTotals, sortOptionIndexesByTotal, winningOptionIndex } from "@/lib/matrix";
import { normalizeBrief } from "@/components/projects/design-brief-card";
import type {
  ConclusionAnswer,
  ConclusionQuestion,
  DesignBrief,
  GanttData,
  ProjectMathImage,
  ProjectSketch,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ProjectPayload = {
  title: string;
  team_photo_url: string | null;
  problem_title: string | null;
  school_name: string | null;
  course_title: string | null;
  start_date: string | null;
  end_date: string | null;
  design_problem: string | null;
  title_page_updated_at: string | null;
  design_brief: DesignBrief | null;
  design_brief_updated_at: string | null;
  team_member_names: string[];
  brainstorm_sketches: ProjectSketch[];
  initial_design_sketches: ProjectSketch[];
  final_sketches: ProjectSketch[];
  matrix_criteria: string[];
  matrix_options: string[];
  matrix_ratings: number[][];
  matrix_updated_at: string | null;
  gantt_data: GanttData | null;
  gantt_updated_at: string | null;
  math_notes: string | null;
  math_notes_updated_at: string | null;
  math_images: ProjectMathImage[];
  conclusion_questions: ConclusionQuestion[];
  conclusion_answers: ConclusionAnswer[];
};

type LogRow = { content: string; image_urls: string[]; created_at: string };

function parseStartDate(s?: string): Date | null {
  if (!s) return null;
  const parts = s.split("-").map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1);
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function fmtMonthDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString();
}

function workdayOffsetToDate(start: Date, dayOffset: number): Date {
  const week = Math.floor(dayOffset / 5);
  const dow = ((dayOffset % 5) + 5) % 5;
  return addDays(start, week * 7 + dow);
}

const DAY_LABELS = ["M", "T", "W", "Th", "F"];

export function NotebookPdfExport({ project, logs }: { project: ProjectPayload; logs: LogRow[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = project.matrix_ratings.length ? optionTotals(project.matrix_ratings) : [];
  const winnerIdx = totals.length ? winningOptionIndex(totals) : -1;
  const rankedIndexes = sortOptionIndexesByTotal(totals);

  const gantt = project.gantt_data;
  const ganttTasks = Array.isArray(gantt?.tasks) ? gantt!.tasks : [];
  const ganttMembers = Array.isArray(gantt?.members) ? gantt!.members : [];
  const ganttStart = parseStartDate(gantt?.startDate);
  const totalWeeks =
    gantt && Number.isFinite(gantt.totalWeeks) && (gantt.totalWeeks ?? 0) > 0 ? (gantt.totalWeeks as number) : 0;
  const viewMode = gantt?.viewMode ?? "weeks";

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

  const ganttCells = viewMode === "days" ? totalWeeks * 5 : totalWeeks;

  const brief = normalizeBrief(project.design_brief);

  const answerByQuestion: Record<string, ConclusionAnswer> = Object.fromEntries(
    project.conclusion_answers.map((a) => [a.question_id, a]),
  );

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

          <section>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Title page</h2>
            {project.title_page_updated_at && (
              <p style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>
                Last updated {fmtDate(project.title_page_updated_at)}
              </p>
            )}
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              {project.problem_title?.trim() || <em style={{ fontWeight: 400, color: "#666" }}>Untitled problem</em>}
            </p>
            <p style={{ fontSize: 11, color: "#444", marginBottom: 6 }}>
              {(() => {
                const startStr = fmtDate(project.start_date);
                const endStr = fmtDate(project.end_date);
                const dateRange = startStr && endStr ? `${startStr} – ${endStr}` : (startStr ?? endStr ?? null);
                const parts = [
                  project.school_name && project.course_title
                    ? `${project.school_name} · ${project.course_title}`
                    : (project.school_name ?? project.course_title ?? null),
                  dateRange,
                ].filter(Boolean);
                return parts.length > 0 ? parts.join(" · ") : "—";
              })()}
            </p>
            {project.team_photo_url && (
              <div style={{ marginBottom: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={project.team_photo_url}
                  alt=""
                  style={{ maxWidth: 400, border: "1px solid #ddd" }}
                />
              </div>
            )}
            <p style={{ fontSize: 11, marginBottom: 6 }}>
              <strong>Team members:</strong>{" "}
              {project.team_member_names.length > 0 ? project.team_member_names.join(", ") : "—"}
            </p>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Design problem</p>
              {project.design_problem ? (
                <p style={{ fontSize: 11, whiteSpace: "pre-wrap", color: "#222" }}>{project.design_problem}</p>
              ) : (
                <p style={{ fontSize: 11, color: "#777", fontStyle: "italic" }}>No design problem written.</p>
              )}
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Design brief</h2>
            {project.design_brief_updated_at && (
              <p style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>
                Last updated {fmtDate(project.design_brief_updated_at)}
              </p>
            )}
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
              <tbody>
                {(
                  [
                    ["Design Brief", null],
                    ["Client", brief.client],
                    ["Target Consumer", brief.target_consumer],
                    ["Design Team", brief.design_team],
                    ['"Problem" Or Need', project.design_problem ?? ""],
                    ["Design Statement", brief.design_statement],
                  ] as Array<[string, string | null]>
                ).map(([label, value]) => (
                  <tr key={label}>
                    <th
                      style={{
                        border: "1px solid #ccc",
                        padding: "4px 6px",
                        textAlign: "left",
                        background: "#f6f6f6",
                        width: 160,
                        verticalAlign: "top",
                      }}
                    >
                      {label}
                    </th>
                    <td style={{ border: "1px solid #ccc", padding: "4px 6px", verticalAlign: "top" }}>
                      {value === null ? (
                        <em style={{ color: "#666" }}>Project specification</em>
                      ) : value ? (
                        <span style={{ whiteSpace: "pre-wrap" }}>{value}</span>
                      ) : (
                        <em style={{ color: "#666" }}>—</em>
                      )}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th
                    style={{
                      border: "1px solid #ccc",
                      padding: "4px 6px",
                      textAlign: "left",
                      background: "#f6f6f6",
                      verticalAlign: "top",
                    }}
                  >
                    Criteria
                  </th>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", verticalAlign: "top" }}>
                    {brief.criteria.length === 0 ? (
                      <em style={{ color: "#666" }}>—</em>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {brief.criteria.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
                <tr>
                  <th
                    style={{
                      border: "1px solid #ccc",
                      padding: "4px 6px",
                      textAlign: "left",
                      background: "#f6f6f6",
                      verticalAlign: "top",
                    }}
                  >
                    Deliverables
                  </th>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", verticalAlign: "top" }}>
                    {brief.deliverables.length === 0 ? (
                      <em style={{ color: "#666" }}>—</em>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {brief.deliverables.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Brainstorming sketches</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {project.brainstorm_sketches.map((s) => (
                <div key={s.id} style={{ width: 200 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="" style={{ width: 200, height: 140, objectFit: "cover", border: "1px solid #ddd" }} />
                  <p style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
                    {s.member_label ? (
                      <>
                        Drawn by <span style={{ fontWeight: 600 }}>{s.member_label}</span>
                      </>
                    ) : (
                      <em>Unlabeled</em>
                    )}
                    {" · Uploaded "}
                    {fmtDate(s.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Decision matrix</h2>
            {project.matrix_updated_at && (
              <p style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>Last updated {fmtDate(project.matrix_updated_at)}</p>
            )}
            {winnerIdx >= 0 && (
              <p style={{ fontSize: 12 }}>
                Leading option: {project.matrix_options[winnerIdx]} (total {totals[winnerIdx]})
              </p>
            )}
            {project.matrix_options.length > 0 && project.matrix_criteria.length > 0 && (
              <table
                style={{
                  marginTop: 8,
                  borderCollapse: "collapse",
                  fontSize: 11,
                  width: "100%",
                }}
              >
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "left", background: "#f6f6f6" }}>Option</th>
                    {project.matrix_criteria.map((c, i) => (
                      <th key={i} style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", background: "#f6f6f6" }}>
                        {c || `C${i + 1}`}
                      </th>
                    ))}
                    <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "right", background: "#f6f6f6" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {project.matrix_options.map((opt, row) => (
                    <tr key={row} style={row === winnerIdx ? { background: "#fff7d6" } : undefined}>
                      <td style={{ border: "1px solid #ccc", padding: "4px 6px", fontWeight: 600 }}>{opt || `Option ${row + 1}`}</td>
                      {project.matrix_criteria.map((_, col) => (
                        <td key={col} style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center" }}>
                          {project.matrix_ratings[row]?.[col] ?? "—"}
                        </td>
                      ))}
                      <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "right", fontFamily: "monospace" }}>
                        {totals[row] ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <ul style={{ fontSize: 11, marginTop: 6 }}>
              {rankedIndexes.map((idx) => (
                <li key={project.matrix_options[idx] ?? idx}>
                  {project.matrix_options[idx]}: {totals[idx]}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Initial design sketch</h2>
            {project.initial_design_sketches.length === 0 ? (
              <p style={{ fontSize: 11, color: "#555" }}>No initial design sketches uploaded.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {project.initial_design_sketches.map((s) => (
                  <div key={s.id} style={{ width: 200 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt="" style={{ width: 200, height: 140, objectFit: "cover", border: "1px solid #ddd" }} />
                    <p style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Uploaded {fmtDate(s.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Gantt</h2>
            {project.gantt_updated_at && (
              <p style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>Last updated {fmtDate(project.gantt_updated_at)}</p>
            )}
            {ganttTasks.length === 0 ? (
              <p style={{ fontSize: 11, color: "#555" }}>No tasks recorded.</p>
            ) : (
              <>
                <p style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>
                  {gantt?.startDate ? `Starts ${gantt.startDate}` : "No start date set"} · view: {viewMode}
                </p>
                <table
                  style={{
                    borderCollapse: "collapse",
                    fontSize: 10,
                    tableLayout: "fixed",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #ccc", padding: "3px 6px", background: "#f6f6f6", textAlign: "left", width: 120 }}>Task</th>
                      {ganttMembers.length > 0 && (
                        <th style={{ border: "1px solid #ccc", padding: "3px 6px", background: "#f6f6f6", textAlign: "left", width: 110 }}>Members</th>
                      )}
                      {Array.from({ length: ganttCells }, (_, idx) => {
                        const date = ganttStart
                          ? viewMode === "days"
                            ? workdayOffsetToDate(ganttStart, idx)
                            : workdayOffsetToDate(ganttStart, idx * 5)
                          : null;
                        return (
                          <th
                            key={idx}
                            style={{
                              border: "1px solid #ccc",
                              padding: "3px 4px",
                              background: "#f6f6f6",
                              textAlign: "center",
                              fontWeight: 600,
                            }}
                          >
                            <div>{viewMode === "days" ? DAY_LABELS[idx % 5] : `Week ${idx + 1}`}</div>
                            {date && <div style={{ fontWeight: 400, color: "#666" }}>{fmtMonthDay(date)}</div>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {ganttTasks.map((t) => {
                      const memberIds = Array.isArray(t.memberIds) ? t.memberIds : [];
                      const taskMembers = ganttMembers.filter((m) => memberIds.includes(m.id));
                      const startDay = Number.isFinite(t.startDay) ? t.startDay : 0;
                      const durationDays = Number.isFinite(t.durationDays) ? t.durationDays : 5;
                      const startCell = viewMode === "days" ? startDay : Math.floor(startDay / 5);
                      const cellSpan =
                        viewMode === "days" ? Math.max(1, durationDays) : Math.max(1, Math.ceil(durationDays / 5));
                      const taskColor = t.color || "#6b7280";
                      const displayColor = taskMembers[0]?.color ?? taskColor;
                      return (
                        <tr key={t.id}>
                          <td style={{ border: "1px solid #ccc", padding: "3px 6px", borderLeft: `3px solid ${taskColor}` }}>
                            {t.name || "—"}
                          </td>
                          {ganttMembers.length > 0 && (
                            <td style={{ border: "1px solid #ccc", padding: "3px 6px", color: "#555" }}>
                              {taskMembers.length > 0 ? taskMembers.map((m) => m.name).join(", ") : "—"}
                            </td>
                          )}
                          {Array.from({ length: ganttCells }, (_, idx) => {
                            const active = idx >= startCell && idx < startCell + cellSpan;
                            return (
                              <td
                                key={idx}
                                style={{
                                  border: "1px solid #ccc",
                                  height: 18,
                                  background: active ? displayColor : "#fff",
                                }}
                              />
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </section>
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Math</h2>
            {project.math_notes_updated_at && (
              <p style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>Notes last updated {fmtDate(project.math_notes_updated_at)}</p>
            )}
            {project.math_notes && (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 11,
                  background: "#f6f6f6",
                  border: "1px solid #ddd",
                  padding: 8,
                  borderRadius: 4,
                  fontFamily: "monospace",
                }}
              >
                {project.math_notes}
              </pre>
            )}
            {project.math_images.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {project.math_images.map((img) => (
                  <div key={img.id} style={{ width: 200 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" style={{ width: 200, height: 140, objectFit: "cover", border: "1px solid #ddd" }} />
                    <p style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Uploaded {fmtDate(img.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
            {!project.math_notes && project.math_images.length === 0 && (
              <p style={{ fontSize: 11, color: "#555" }}>No math content added.</p>
            )}
          </section>
          {project.conclusion_questions.length > 0 && (
            <section>
              <h2 style={{ fontSize: 16, marginBottom: 8 }}>Conclusion</h2>
              <ol style={{ paddingLeft: 18, fontSize: 11 }}>
                {project.conclusion_questions.map((q) => {
                  const a = answerByQuestion[q.id];
                  return (
                    <li key={q.id} style={{ marginBottom: 8 }}>
                      <p style={{ fontWeight: 600 }}>{q.prompt}</p>
                      {a && a.body.trim() ? (
                        <p style={{ whiteSpace: "pre-wrap", color: "#333" }}>{a.body}</p>
                      ) : (
                        <p style={{ color: "#777", fontStyle: "italic" }}>No answer yet.</p>
                      )}
                      {a?.updated_at && (
                        <p style={{ fontSize: 9, color: "#777", marginTop: 2 }}>Last updated {fmtDate(a.updated_at)}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
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
              {project.final_sketches.map((s) => (
                <div key={s.id} style={{ width: 200 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="" style={{ width: 200, height: 140, objectFit: "cover", border: "1px solid #ddd" }} />
                  <p style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Uploaded {fmtDate(s.created_at)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
