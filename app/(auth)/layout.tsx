import { EngiLogLogo } from "@/components/engilog-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <EngiLogLogo size={48} className="size-12 shrink-0 rounded-lg shadow-sm" />
        <span className="text-lg font-semibold tracking-tight">EngiLog</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
