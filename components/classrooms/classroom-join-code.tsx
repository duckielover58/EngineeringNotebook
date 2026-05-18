export function ClassroomJoinCode({ code }: { code: string }) {
  return (
    <p className="mt-1 text-muted-foreground">
      Join code: <span className="font-mono font-medium tracking-widest text-foreground">{code}</span>
    </p>
  );
}

export function ClassroomJoinCodeBadge({ code }: { code: string }) {
  return (
    <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm tracking-widest">{code}</span>
  );
}
