"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormType = z.infer<typeof loginSchema>;

// credentials -> (new device: email code) -> (2-step verification: authenticator code or backup code)
type Step = "credentials" | "email-code" | "totp" | "backup";

const errorText = (error: unknown, fallback: string) => {
  const e = error as { longMessage?: string; message?: string } | null;
  return e?.longMessage || e?.message || fallback;
};

export default function SignInForm() {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState<Step>("credentials");
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();
  const busy = isPending || fetchStatus === "fetching";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormType>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function finish() {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          toast.error("Your account needs one more setup step before you can continue.");
          return;
        }
        const url = decorateUrl("/dashboard");
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
  }

  // Looks at where Clerk says the sign-in stands and moves to the matching step.
  async function next() {
    if (signIn.status === "complete") return finish();

    if (signIn.status === "needs_client_trust") {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) return void toast.error(errorText(error, "Could not send the code"));
      setCode("");
      setStep("email-code");
      return;
    }

    if (signIn.status === "needs_second_factor") {
      const strategies = signIn.supportedSecondFactors?.map((f) => f.strategy) ?? [];
      if (strategies.includes("totp")) {
        setCode("");
        setStep("totp");
      } else if (strategies.includes("email_code")) {
        await signIn.mfa.sendEmailCode();
        setCode("");
        setStep("email-code");
      } else {
        toast.error("This account uses a verification method that is not supported here.");
      }
      return;
    }

    toast.error("Sign-in could not be completed. Please try again.");
  }

  function onSubmit(values: LoginFormType) {
    startTransition(async () => {
      try {
        const { error } = await signIn.password({
          identifier: values.email,
          password: values.password,
        });
        if (error) return void toast.error(errorText(error, "Email or password is incorrect"));
        await next();
      } catch (err) {
        console.error(err);
        toast.error("Sign in failed");
      }
    });
  }

  function verify() {
    startTransition(async () => {
      try {
        const trimmed = code.trim();
        const { error } =
          step === "email-code"
            ? await signIn.mfa.verifyEmailCode({ code: trimmed })
            : step === "backup"
              ? await signIn.mfa.verifyBackupCode({ code: trimmed })
              : await signIn.mfa.verifyTOTP({ code: trimmed });
        if (error) return void toast.error(errorText(error, "That code is not valid"));
        await next();
      } catch (err) {
        console.error(err);
        toast.error("Verification failed");
      }
    });
  }

  if (step !== "credentials") {
    const title =
      step === "email-code" ? "Check your email" : step === "backup" ? "Enter a backup code" : "Enter your authenticator code";
    const hint =
      step === "email-code"
        ? "We sent a verification code to your email address."
        : step === "backup"
          ? "Use one of the backup codes you saved. Each code works once."
          : "Open your authenticator app and enter the 6-digit code.";

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground text-sm">{hint}</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode={step === "backup" ? "text" : "numeric"}
              autoFocus
            />
          </div>
          <Button type="submit" disabled={busy || code.trim() === ""} className="w-full">
            {busy ? <Spinner /> : "Verify"}
          </Button>
        </form>

        <div className="flex flex-col gap-1 text-sm">
          {step === "email-code" && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-left underline underline-offset-4"
              onClick={async () => {
                const { error } = await signIn.mfa.sendEmailCode();
                if (error) toast.error(errorText(error, "Could not send the code"));
                else toast.success("A new code was sent");
              }}
            >
              Send a new code
            </button>
          )}
          {step === "totp" && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-left underline underline-offset-4"
              onClick={() => {
                setCode("");
                setStep("backup");
              }}
            >
              Use a backup code instead
            </button>
          )}
          {step === "backup" && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-left underline underline-offset-4"
              onClick={() => {
                setCode("");
                setStep("totp");
              }}
            >
              Use my authenticator app
            </button>
          )}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-left underline underline-offset-4"
            onClick={() => {
              signIn.reset();
              setStep("credentials");
            }}
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          {...register("email")}
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
        />
        {errors.email && (
          <p className="text-destructive text-sm">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            {...register("password")}
            type={isVisible ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setIsVisible(!isVisible)}
            className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          >
            {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-destructive text-sm">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? <Spinner /> : "Sign in"}
      </Button>
    </form>
  );
}
