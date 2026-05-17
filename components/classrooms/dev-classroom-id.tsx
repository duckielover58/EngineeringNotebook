/** Shown only for dev/test accounts (see isDevTestUser). */
export function DevClassroomId({ id }: { id: string }) {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Classroom ID: <span className="select-all font-mono text-foreground">{id}</span>
    </p>
  );
}
