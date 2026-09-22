"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type Step = "email" | "code" | "password";

const errorText = (error: unknown, fallback: string) => {
  const e = error as { longMessage?: string; message?: string } | null;
  return e?.longMessage || e?.message || fallback;
};

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();
  const busy = isPending || fetchStatus === "fetching";

  // 1) ask Clerk to email a reset code
  function sendCode() {
    startTransition(async () => {
      const created = await signIn.create({ identifier: email.trim() });
      if (created.error) return void toast.error(errorText(created.error, "Could not start the reset"));
      const sent = await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) return void toast.error(errorText(sent.error, "Could not send the code"));
      toast.success("We sent a code to your email");
      setStep("code");
    });
  }

  // 2) check the code
  function verifyCode() {
    startTransition(async () => {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
      if (error) return void toast.error(errorText(error, "That code is not valid"));
      setStep("password");
    });
  }

  // 3) set the new password (and end other sessions, which is what you want after a reset)
  function submitPassword() {
    startTransition(async () => {
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({
        password,
        signOutOfOtherSessions: true,
      });
      if (error) return void toast.error(errorText(error, "Could not set the new password"));

      toast.success("Your password was changed");
      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl("/dashboard");
            if (url.startsWith("http")) window.location.href = url;
            else router.push(url);
          },
        });
      } else {
        // e.g. the account also needs its second step: sign in normally with the new password
        signIn.reset();
        router.push("/sign-in");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "email") sendCode();
        else if (step === "code") verifyCode();
        else submitPassword();
      }}
      className="space-y-4"
    >
      {step === "email" && (
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
          />
        </div>
      )}

      {step === "code" && (
        <div className="space-y-1.5">
          <Label htmlFor="code">Code from your email</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
        </div>
      )}

      {step === "password" && (
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            autoFocus
          />
        </div>
      )}

      <Button
        type="submit"
        disabled={busy || (step === "email" ? !email : step === "code" ? !code : password.length < 8)}
        className="w-full"
      >
        {busy ? (
          <Spinner />
        ) : step === "email" ? (
          "Send reset code"
        ) : step === "code" ? (
          "Verify code"
        ) : (
          "Set new password"
        )}
      </Button>
    </form>
  );
}
