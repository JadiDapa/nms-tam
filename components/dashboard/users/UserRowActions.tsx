"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmAction from "../ConfirmAction";
import { deletePendingUser, resendInvitation, updateUser } from "@/app/action/user.action";

type Props = {
  userId: number;
  joined: boolean;
  active: boolean;
  isSelf: boolean;
};

export default function UserRowActions({ userId, joined, active, isSelf }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!joined) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const r = await resendInvitation(userId);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Invitation sent again");
            })
          }
        >
          Resend invite
        </Button>
        <ConfirmAction
          trigger={<Button variant="outline" size="sm" className="text-destructive h-7">Remove</Button>}
          title="Remove this invitation?"
          description="The person has not signed up yet. Their invitation record is deleted."
          confirmLabel="Remove"
          destructive
          successMessage="Invitation removed"
          onConfirm={() => deletePendingUser(userId)}
        />
      </div>
    );
  }

  return active ? (
    <ConfirmAction
      trigger={<Button variant="outline" size="sm" className="h-7" disabled={isSelf}>Deactivate</Button>}
      title="Deactivate this user?"
      description="They are signed out and cannot sign in until you reactivate them. Their history stays."
      confirmLabel="Deactivate"
      destructive
      successMessage="User deactivated"
      onConfirm={() => updateUser(userId, { active: false })}
    />
  ) : (
    <Button
      variant="outline"
      size="sm"
      className="h-7"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const r = await updateUser(userId, { active: true });
          if (!r.ok) return void toast.error(r.error);
          toast.success("User reactivated");
          router.refresh();
        })
      }
    >
      Reactivate
    </Button>
  );
}
