export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
