"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { updateProjectTitlePage } from "@/actions/projects";
import { parseNotebookTitleSuffix } from "@/lib/notebook-title";
import { createClient } from "@/lib/supabase/client";
import { uploadProjectFile } from "@/lib/storage-upload";
import { Button } from "@/components/ui/button";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatStamp } from "@/lib/format-stamp";

export type TitlePageData = {
  problem_title: string | null;
  school_name: string | null;
  course_title: string | null;
  start_date: string | null;
  end_date: string | null;
  design_problem: string | null;
  team_photo_url: string | null;
  title_page_updated_at: string | null;
};

export type TeamMember = { id: string; full_name: string | null };

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  // Treat plain YYYY-MM-DD as a calendar date in local time so it doesn't shift by a day.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString();
}

/**
 * Reusable title-page form body. Owns its own draft state. The caller renders
 * the action buttons via `actionsSlot` so it can be embedded in a wizard step
 * (with a "Continue" button) or in the overview card (with Save/Cancel).
 */
export function TitlePageForm({
  projectId,
  notebookTitle,
  initial,
  onSavedAction,
  busyExternally,
  actionsSlot,
}: {
  projectId: string;
  notebookTitle: string;
  initial: TitlePageData;
  onSavedAction: (saved: TitlePageData, notebookTitle?: string) => void;
  busyExternally?: boolean;
  actionsSlot: (ctx: { save: () => Promise<boolean>; pending: boolean }) => ReactNode;
}) {
  const router = useRouter();
  const [notebookTitleSuffix, setNotebookTitleSuffix] = useState(() => parseNotebookTitleSuffix(notebookTitle));
  const [problemTitle, setProblemTitle] = useState(initial.problem_title ?? "");
  const [schoolName, setSchoolName] = useState(initial.school_name ?? "");
  const [courseTitle, setCourseTitle] = useState(initial.course_title ?? "");
  const [startDate, setStartDate] = useState(initial.start_date ?? "");
  const [endDate, setEndDate] = useState(initial.end_date ?? "");
  const [designProblem, setDesignProblem] = useState(initial.design_problem ?? "");
  const [teamPhotoUrl, setTeamPhotoUrl] = useState<string | null>(initial.team_photo_url ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview for a newly picked file (before save). Kept separate from the
  // saved URL so we can clearly label which one is shown.
  const localPreviewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );
  useEffect(() => {
    if (!localPreviewUrl) return;
    return () => URL.revokeObjectURL(localPreviewUrl);
  }, [localPreviewUrl]);
  const previewSrc = localPreviewUrl ?? teamPhotoUrl;
  const previewIsLocal = !!localPreviewUrl;

  async function save(): Promise<boolean> {
    setError(null);
    if (startDate && endDate && endDate < startDate) {
      setError("End date must be on or after the start date.");
      return false;
    }
    setPending(true);
    try {
      let nextPhotoUrl: string | null | undefined = undefined;
      if (photoFile) {
        const supabase = createClient();
        nextPhotoUrl = await uploadProjectFile(supabase, "team-photos", projectId, photoFile);
      }
      const res = await updateProjectTitlePage(projectId, {
        notebook_title_suffix: notebookTitleSuffix,
        problem_title: problemTitle.trim() || null,
        school_name: schoolName.trim() || null,
        course_title: courseTitle.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        design_problem: designProblem.trim() || null,
        ...(nextPhotoUrl !== undefined ? { team_photo_url: nextPhotoUrl } : {}),
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return false;
      }
      const savedAt =
        "updatedAt" in res && typeof res.updatedAt === "string"
          ? res.updatedAt
          : initial.title_page_updated_at;
      if (nextPhotoUrl) setTeamPhotoUrl(nextPhotoUrl);
      const savedNotebookTitle =
        "notebookTitle" in res && typeof res.notebookTitle === "string" ? res.notebookTitle : undefined;
      onSavedAction(
        {
          problem_title: problemTitle.trim() || null,
          school_name: schoolName.trim() || null,
          course_title: courseTitle.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          design_problem: designProblem.trim() || null,
          team_photo_url: nextPhotoUrl ?? teamPhotoUrl,
          title_page_updated_at: savedAt,
        },
        savedNotebookTitle
      );
      setPhotoFile(null);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setPending(false);
    }
  }

  const busy = pending || !!busyExternally;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="notebook-title">Notebook title</Label>
        <Input
          id="notebook-title"
          value={notebookTitleSuffix}
          onChange={(e) => setNotebookTitleSuffix(e.target.value)}
          placeholder="e.g. Solar oven prototype"
          disabled={busy}
          required
        />
        <p className="text-xs text-muted-foreground">
          Shown in the page header and class list. Your name is added automatically.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="problem-title">Title of the problem</Label>
        <Input
          id="problem-title"
          value={problemTitle}
          onChange={(e) => setProblemTitle(e.target.value)}
          placeholder="e.g. Solar-powered boat that travels straight"
          disabled={busy}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="school-name">School name</Label>
          <Input
            id="school-name"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="e.g. American High School"
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="course-title">Course title</Label>
          <Input
            id="course-title"
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            placeholder="e.g. POE H"
            disabled={busy}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start-date">Start date</Label>
          <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={busy} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">End date</Label>
          <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={busy} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="team-photo">Team photo</Label>
        {previewSrc ? (
          <div className="space-y-1">
            <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-md border bg-muted">
              <PhotoLightbox src={previewSrc} alt="Team photo" className="absolute inset-0 block h-full w-full">
                {previewIsLocal ? (
                  // Use a plain <img> for the local object URL preview so Next/Image's
                  // optimizer doesn't try to fetch a blob: URL.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewSrc} alt="Selected team photo preview" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Image src={previewSrc} alt="Team" fill className="object-cover" sizes="(max-width:768px) 100vw, 50vw" />
                )}
              </PhotoLightbox>
            </div>
            <p className="text-xs text-muted-foreground">
              {previewIsLocal ? "Selected file (not yet saved)" : "Saved team photo"}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No team photo yet.</p>
        )}
        <Input
          id="team-photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
        <p className="text-xs text-muted-foreground">Uploading a new photo replaces the existing one.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="design-problem">Design problem</Label>
        <Textarea
          id="design-problem"
          rows={4}
          value={designProblem}
          onChange={(e) => setDesignProblem(e.target.value)}
          placeholder="Describe the problem your team is solving. This is also shown as the design brief's 'Problem' Or Need."
          disabled={busy}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">{actionsSlot({ save, pending })}</div>
    </div>
  );
}

function TitlePageView({
  notebookTitle,
  data,
  teamMembers,
}: {
  notebookTitle: string;
  data: TitlePageData;
  teamMembers: TeamMember[];
}) {
  const startStr = formatDate(data.start_date);
  const endStr = formatDate(data.end_date);
  const dateRange = startStr && endStr ? `${startStr} – ${endStr}` : (startStr ?? endStr ?? null);
  const memberNames = teamMembers
    .map((m) => (m.full_name ?? "").trim())
    .filter((n) => n.length > 0);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Notebook title</p>
        <p className="text-sm text-muted-foreground">{notebookTitle}</p>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {data.problem_title?.trim() || <span className="italic text-muted-foreground">Untitled problem</span>}
        </h2>
        <div className="mt-1 text-sm text-muted-foreground">
          {data.school_name && data.course_title
            ? `${data.school_name} · ${data.course_title}`
            : data.school_name ?? data.course_title ?? null}
          {dateRange && (
            <>
              {(data.school_name || data.course_title) && <> · </>}
              {dateRange}
            </>
          )}
        </div>
      </div>

      {data.team_photo_url ? (
        <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-md border bg-muted">
          <PhotoLightbox src={data.team_photo_url} alt="Team photo" className="absolute inset-0 block h-full w-full">
            <Image src={data.team_photo_url} alt="Team" fill className="object-cover" sizes="(max-width:768px) 100vw, 50vw" />
          </PhotoLightbox>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No team photo uploaded.</p>
      )}

      <div>
        <p className="text-sm font-medium">Team members</p>
        {memberNames.length > 0 ? (
          <p className="text-sm text-muted-foreground">{memberNames.join(", ")}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No team members on file yet.</p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium">Design problem</p>
        {data.design_problem ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.design_problem}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">No design problem written yet.</p>
        )}
      </div>
    </div>
  );
}

export function TitlePageCard({
  projectId,
  notebookTitle: initialNotebookTitle,
  initial,
  teamMembers,
  canEdit,
}: {
  projectId: string;
  notebookTitle: string;
  initial: TitlePageData;
  teamMembers: TeamMember[];
  canEdit: boolean;
}) {
  const [data, setData] = useState<TitlePageData>(initial);
  const [notebookTitle, setNotebookTitle] = useState(initialNotebookTitle);
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Title page</CardTitle>
          <CardDescription>
            {data.title_page_updated_at
              ? `Last updated ${formatStamp(data.title_page_updated_at)}`
              : "Team identity and the problem your team is tackling."}
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
          <TitlePageForm
            projectId={projectId}
            notebookTitle={notebookTitle}
            initial={data}
            onSavedAction={(saved, savedNotebookTitle) => {
              setData(saved);
              if (savedNotebookTitle) setNotebookTitle(savedNotebookTitle);
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
          <TitlePageView notebookTitle={notebookTitle} data={data} teamMembers={teamMembers} />
        )}
      </CardContent>
    </Card>
  );
}
