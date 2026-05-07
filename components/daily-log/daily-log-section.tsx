"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { addProjectComment } from "@/actions/comments";
import { createDailyLog, updateDailyLog } from "@/actions/daily-logs";
import { useLogEditable } from "@/hooks/use-log-editable";
import { createClient } from "@/lib/supabase/client";
import { uploadProjectFile } from "@/lib/storage-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Log = {
  id: string;
  content: string;
  image_urls: string[];
  created_at: string;
  is_locked: boolean;
};

type CommentRow = { id: string; body: string; created_at: string; teacher_id: string };

function LogCard({
  log,
  projectId,
  canEditLog,
  isTeacherView,
  comments,
}: {
  log: Log;
  projectId: string;
  canEditLog: boolean;
  isTeacherView: boolean;
  comments: CommentRow[];
}) {
  const router = useRouter();
  const editable = useLogEditable(log.created_at, log.is_locked);
  const effectiveEditable = canEditLog && editable;
  const [content, setContent] = useState(log.content);
  const [urls, setUrls] = useState<string[]>(log.image_urls);
  const [files, setFiles] = useState<File[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [commentPending, setCommentPending] = useState(false);

  const lockedLabel = useMemo(() => {
    if (log.is_locked) return "Locked";
    if (!editable) return "Locked (24h)";
    return null;
  }, [log.is_locked, editable]);

  async function save() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const nextUrls = [...urls];
      for (const f of files) {
        if (nextUrls.length >= 3) break;
        nextUrls.push(await uploadProjectFile(supabase, "log-images", projectId, f));
      }
      const res = await updateDailyLog(log.id, projectId, content, nextUrls.slice(0, 3));
      if ("error" in res && res.error) {
        setError(res.error);
        setPending(false);
        return;
      }
      setFiles([]);
      setUrls(nextUrls.slice(0, 3));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
    setPending(false);
  }

  async function submitComment() {
    setCommentError(null);
    setCommentPending(true);
    const res = await addProjectComment(projectId, commentBody, `daily_log:${log.id}`);
    setCommentPending(false);
    if ("error" in res && res.error) {
      setCommentError(res.error);
      return;
    }
    setCommentBody("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Log</CardTitle>
          <CardDescription>{new Date(log.created_at).toLocaleString()}</CardDescription>
        </div>
        {lockedLabel && <span className="text-xs font-medium text-muted-foreground">{lockedLabel}</span>}
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} disabled={!effectiveEditable} rows={4} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {urls.map((u) => (
            <div key={u} className="relative aspect-video overflow-hidden rounded-md border bg-muted">
              <Image src={u} alt="" fill className="object-cover" sizes="120px" />
            </div>
          ))}
        </div>
        {effectiveEditable && (
          <div className="space-y-2">
            <Input type="file" accept="image/*" multiple capture="environment" disabled={urls.length >= 3} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            <p className="text-xs text-muted-foreground">Up to three images per log. {3 - urls.length} slots left.</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="sm" onClick={save} disabled={pending}>
              Save changes
            </Button>
          </div>
        )}
        <div className="space-y-2 rounded-md border border-dashed bg-muted/30 p-3">
          <p className="text-sm font-medium">Teacher comments</p>
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No teacher comments for this log yet.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded border bg-yellow-50/80 p-2 text-xs dark:bg-yellow-950/30">
                  <p>{c.body}</p>
                  <p className="mt-1 text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
          {isTeacherView && (
            <div className="space-y-2 pt-1">
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Leave feedback for this daily log…"
                rows={2}
              />
              {commentError && <p className="text-sm text-destructive">{commentError}</p>}
              <Button size="sm" onClick={submitComment} disabled={commentPending || !commentBody.trim()}>
                {commentPending ? "Posting…" : "Post comment"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DailyLogSection({
  projectId,
  initialLogs,
  isTeacherView,
  commentsByLogId,
}: {
  projectId: string;
  initialLogs: Log[];
  isTeacherView: boolean;
  commentsByLogId: Record<string, CommentRow[]>;
}) {
  const router = useRouter();
  const canEditLogs = !isTeacherView;
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const urls: string[] = [];
      for (const f of files.slice(0, 3)) {
        urls.push(await uploadProjectFile(supabase, "log-images", projectId, f));
      }
      const res = await createDailyLog(projectId, content, urls);
      if ("error" in res && res.error) {
        setError(res.error);
        setPending(false);
        return;
      }
      setContent("");
      setFiles([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create log");
    }
    setPending(false);
  }

  return (
    <div className="space-y-6">
      {canEditLogs ? (
        <Card>
          <CardHeader>
            <CardTitle>New daily log</CardTitle>
            <CardDescription>Upload 1–3 workshop photos with your summary. Logs lock for editing after 24 hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What did your team accomplish today?" rows={4} />
            <Input type="file" accept="image/*" multiple capture="environment" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Submit log"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Daily logs (read-only)</CardTitle>
            <CardDescription>Teachers can review logs and add comments next to each log card.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">History</h2>
        {initialLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No logs yet.</p>
        ) : (
          initialLogs.map((log) => (
            <LogCard
              key={log.id}
              log={log}
              projectId={projectId}
              canEditLog={canEditLogs}
              isTeacherView={isTeacherView}
              comments={commentsByLogId[log.id] ?? []}
            />
          ))
        )}
      </div>
    </div>
  );
}
