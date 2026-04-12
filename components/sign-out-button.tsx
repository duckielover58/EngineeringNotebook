"use client";

import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      className="w-full justify-start gap-2"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = "/login";
      }}
    >
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}
