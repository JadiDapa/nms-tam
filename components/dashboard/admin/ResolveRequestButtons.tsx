"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { resolveBillingRequest } from "@/app/action/billing.action";

export default function ResolveRequestButtons({ requestId }: { requestId: number }) {
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function resolve(status: "DONE" | "REJECTED") {
    startTransition(async () => {
      const r = await resolveBillingRequest(requestId, { status, adminNote: note });
      if (!r.ok) return void toast.error(r.error);
      toast.success(status === "DONE" ? "Marked as done" : "Rejected");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input className="h-8 w-56" placeholder="Note to the client (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" disabled={isPending} onClick={() => resolve("DONE")}>
        {isPending ? <Spinner /> : "Done"}
      </Button>
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => resolve("REJECTED")}>
        Reject
      </Button>
    </div>
  );
}
