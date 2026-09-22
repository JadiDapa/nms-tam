import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import SignUpForm from "@/components/auth/sign-up/SignUpForm";

export default async function SignUpPage() {
  const { userId } = await auth();

  if (userId) redirect("/dashboard");

  return (
    <AuthShell title="Accept your invitation" description="Choose a password to finish creating your account">
      <Suspense>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}
