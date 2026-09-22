import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import SignInForm from "@/components/auth/sign-in/SignInForm";

export default async function SignInPage() {
  const { userId } = await auth();

  if (userId) redirect("/dashboard");

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your account to continue"
      footer="Accounts are created by invitation. Ask your administrator if you need access."
    >
      <SignInForm />
    </AuthShell>
  );
}
