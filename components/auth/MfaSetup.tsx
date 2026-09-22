"use client";

import { UserProfile } from "@clerk/nextjs";
import SignOutButton from "@/components/auth/SignOutButton";

// Shown instead of the dashboard to a staff account that has no two-step verification yet.
export default function MfaSetup() {
  return (
    <main className="bg-background flex min-h-screen flex-col items-center gap-6 p-6">
      <div className="max-w-xl space-y-2 text-center">
        <h1 className="text-foreground text-2xl font-bold">Turn on two-step verification</h1>
        <p className="text-muted-foreground text-sm">
          Administrator accounts must be protected with an authenticator app. Open <b>Security</b> below, add an
          authenticator app and save your backup codes. This page disappears once it is on.
        </p>
      </div>
      <UserProfile routing="hash" />
      <SignOutButton />
    </main>
  );
}
