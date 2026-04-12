import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your EngiLog account email and password.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <LoginForm />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
