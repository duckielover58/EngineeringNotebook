"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { acceptProjectInvite } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PendingInvite = {
  id: string;
  project_id: string;
  created_at: string;
  invitee_email: string;
  projects: { title: string } | { title: string }[] | null;
};

export function PendingProjectInvites({ invites }: { invites: PendingInvite[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function accept(inviteId: string) {
    setError(null);
    setPendingId(inviteId);
    const res = await acceptProjectInvite(inviteId);
    setPendingId(null);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notebook invites</CardTitle>
        <CardDescription>Accept invites to join team notebooks in this class.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invites.</p>
        ) : (
          invites.map((invite) => {
            const raw = invite.projects;
            const project = Array.isArray(raw) ? raw[0] : raw;
            return (
              <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="font-medium">{project?.title ?? "Notebook"}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited as {invite.invitee_email} · {new Date(invite.created_at).toLocaleString()}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={() => accept(invite.id)} disabled={pendingId === invite.id}>
                  {pendingId === invite.id ? "Accepting…" : "Accept invite"}
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
