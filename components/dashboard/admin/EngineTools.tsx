"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import ConfirmAction from "../ConfirmAction";
import { deleteOrphan, syncAllClients } from "@/app/action/engine.action";
import type { OrphanKind } from "@/servers/services/engine-admin.service";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const r = await syncAllClients();
          if (!r.ok) return void toast.error(r.error);
          toast.success(`${r.data.changed} devices updated${r.data.failed ? `, ${r.data.failed} failed` : ""}`);
          router.refresh();
        })
      }
    >
      {isPending ? <Spinner /> : <RefreshCw className="size-4" />}
      Re-apply pause / resume to all clients
    </Button>
  );
}

export function DeleteOrphanButton({ kind, engineId, name }: { kind: OrphanKind; engineId: string; name: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="outline" size="sm" className="text-destructive h-7">Delete</Button>}
      title={`Delete ${kind} “${name}” from the engine?`}
      description="No client owns it. It is removed from the monitoring engine permanently."
      confirmLabel="Delete"
      destructive
      successMessage="Removed from the engine"
      onConfirm={() => deleteOrphan(kind, engineId)}
    />
  );
}
