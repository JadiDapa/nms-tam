import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import ForgotPasswordForm from "@/components/auth/sign-in/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  const { userId } = await auth();

  if (userId) redirect("/dashboard");

  return (
    <AuthShell
      title="Reset your password"
      description="We will email you a code to set a new password"
      footer={
        <Link href="/sign-in" className="text-foreground text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
