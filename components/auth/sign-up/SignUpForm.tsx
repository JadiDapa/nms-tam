"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const signUpSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type SignUpFormType = z.infer<typeof signUpSchema>;

// Accounts are created by invitation only. The link in the invitation email carries a ticket; without it there is
// nothing to sign up for. The ticket also proves the email address, so no code is asked here.
export default function SignUpForm() {
  const [isVisible, setIsVisible] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { signUp, fetchStatus } = useSignUp();
  const router = useRouter();
  const ticket = useSearchParams().get("__clerk_ticket");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormType>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { password: "", confirm: "" },
  });

  if (!ticket) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        Accounts are created by invitation only. Open the link in your invitation email, or ask your administrator to
        invite you.
      </p>
    );
  }

  function onSubmit(values: SignUpFormType) {
    startTransition(async () => {
      const { error } = await signUp.create({
        strategy: "ticket",
        ticket: ticket!,
        password: values.password,
      });
      if (error) {
        const e = error as { longMessage?: string; message?: string };
        return void toast.error(e.longMessage || e.message || "Could not create your account");
      }

      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl("/dashboard");
            if (url.startsWith("http")) window.location.href = url;
            else router.push(url);
          },
        });
      } else {
        toast.error("Additional verification is required. Please contact your administrator.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">Choose a password</Label>
        <div className="relative">
          <Input
            id="password"
            {...register("password")}
            type={isVisible ? "text" : "password"}
            placeholder="At least 8 characters"
            autoComplete="new-password"
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

      <div className="space-y-1.5">
        <Label htmlFor="confirm">Repeat the password</Label>
        <Input
          id="confirm"
          {...register("confirm")}
          type={isVisible ? "text" : "password"}
          autoComplete="new-password"
        />
        {errors.confirm && (
          <p className="text-destructive text-sm">{errors.confirm.message}</p>
        )}
      </div>

      <div id="clerk-captcha" />

      <Button type="submit" disabled={isPending || fetchStatus === "fetching"} className="w-full">
        {isPending ? <Spinner /> : "Create account"}
      </Button>
    </form>
  );
}
