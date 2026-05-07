"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { inviteStudentToProject, revokeProjectInvite } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type InviteRow = {
  id: string;
  invitee_email: string;
  status: "pending" | "accepted" | "revoked";
  created_at: string;
};

export function ProjectInvitePanel({
  projectId,
  canInvite,
  invites,
}: {
  projectId: string;
  canInvite: boolean;
  invites: InviteRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submitInvite() {
    setError(null);
    setPending(true);
    const res = await inviteStudentToProject(projectId, email);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setEmail("");
    router.refresh();
  }

  async function revoke(inviteId: string) {
    setError(null);
    setPending(true);
    const res = await revokeProjectInvite(inviteId, projectId);
    setPending(false);
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
        <CardDescription>Invite classmates by email, similar to shared docs.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canInvite && (
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              placeholder="student@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button type="button" onClick={submitInvite} disabled={pending || !email.trim()}>
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <ul className="space-y-2">
          {invites.length === 0 ? (
            <li className="text-sm text-muted-foreground">No invites yet.</li>
          ) : (
            invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div>
                  <p className="font-medium">{invite.invitee_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.status} · {new Date(invite.created_at).toLocaleString()}
                  </p>
                </div>
                {canInvite && invite.status === "pending" && (
                  <Button type="button" variant="outline" size="sm" onClick={() => revoke(invite.id)} disabled={pending}>
                    Revoke
                  </Button>
                )}
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
