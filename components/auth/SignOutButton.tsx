"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function SignOutButton() {
  const { signOut } = useClerk();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      onClick={async () => {
        await signOut();
        router.replace("/sign-in");
      }}
    >
      Sign out
    </Button>
  );
}
