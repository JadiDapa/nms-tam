"use client";

import { UserProfile } from "@clerk/nextjs";

// Clerk's own screens handle the password, authenticator app enrolment, backup codes and sessions.
export default function ProfilePanel() {
  return <UserProfile routing="hash" appearance={{ elements: { rootBox: "w-full", cardBox: "w-full max-w-4xl shadow-none border" } }} />;
}
