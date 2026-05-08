import Link from "next/link";
import { BookOpen, GraduationCap, LayoutDashboard, Menu, Plus } from "lucide-react";

import { EngiLogLogo } from "@/components/engilog-logo";
import { syncProfileRoleFromAuth } from "@/actions/profile";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SignOutButton } from "@/components/sign-out-button";

const navBase = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/classrooms", label: "Classrooms", icon: GraduationCap },
  { href: "/classrooms/join", label: "Join class", icon: BookOpen, studentOnly: true as const },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <TooltipProvider>{children}</TooltipProvider>;
  }

  await syncProfileRoleFromAuth();

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();

  const nav = navBase.filter((item) => !("studentOnly" in item) || profile?.role === "student");

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-4">
      <Link href="/dashboard" className="mb-4 flex items-center gap-2 px-2 font-semibold tracking-tight">
        <EngiLogLogo size={28} className="size-7 shrink-0 object-contain" />
        <span>EngiLog</span>
      </Link>
      <Separator className="mb-2" />
      {nav.map((item) => (
        <Button key={item.href} variant="ghost" className="justify-start gap-2" asChild>
          <Link href={item.href}>
            <item.icon className="size-4" />
            {item.label}
          </Link>
        </Button>
      ))}
      {profile?.role === "teacher" && (
        <Button variant="ghost" className="justify-start gap-2" asChild>
          <Link href="/classrooms/new">
            <Plus className="size-4" />
            New classroom
          </Link>
        </Button>
      )}
      <div className="mt-auto space-y-2 pt-6">
        <p className="truncate px-2 text-xs text-muted-foreground">{profile?.full_name || user.email}</p>
        <SignOutButton />
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <aside className="hidden w-56 shrink-0 border-r bg-card md:block">{sidebar}</aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b px-4 md:hidden">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <EngiLogLogo size={24} className="size-6 shrink-0 object-contain" />
              EngiLog
            </Link>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open menu">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                {sidebar}
              </SheetContent>
            </Sheet>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
