"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { joinClassroomByCode } from "@/actions/classrooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinClassroomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await joinClassroomByCode(code);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if ("ok" in res && res.ok) {
      router.push(`/classrooms/${res.classroomId}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="code">6-digit join code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="[0-9]{6}"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="font-mono text-lg tracking-[0.4em]"
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending || code.length !== 6}>
        {pending ? "Joining…" : "Join classroom"}
      </Button>
    </form>
  );
}
