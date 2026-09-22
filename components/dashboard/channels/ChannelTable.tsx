"use client";

import { useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import DataTable from "../DataTable";
import SearchDataTable from "../SearchDataTable";
import TableSorter from "../TableSorter";
import ConfirmAction from "../ConfirmAction";
import { StatusBadge } from "../StatusBadge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { deleteChannel, setChannelEnabled, testChannel } from "@/app/action/channel.action";

export interface ChannelTableType {
  id: number;
  label: string;
  type: string;
  target: string;
  credentialLabel: string | null;
  enabled: boolean;
}

export default function ChannelTable({ channels, canChange }: { channels: ChannelTableType[]; canChange: boolean }) {
  return (
    <DataTable
      columns={channelColumns(canChange)}
      data={channels}
      title="Channels"
      filters={(table) => (
        <div className="grid w-full items-end gap-4 p-4">
          <SearchDataTable table={table} column="label" placeholder="Search channel..." />
        </div>
      )}
    />
  );
}

function EnabledSwitch({ id, enabled, canChange }: { id: number; enabled: boolean; canChange: boolean }) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Switch
      checked={enabled}
      disabled={!canChange}
      onCheckedChange={(v) =>
        startTransition(async () => {
          const r = await setChannelEnabled(id, v);
          if (!r.ok) return void toast.error(r.error);
          router.refresh();
        })
      }
    />
  );
}

function TestButton({ id, canChange }: { id: number; canChange: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7"
      disabled={isPending || !canChange}
      onClick={() =>
        startTransition(async () => {
          const r = await testChannel(id);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Test message delivered");
        })
      }
    >
      {isPending ? <Spinner /> : "Send test"}
    </Button>
  );
}

const channelColumns = (canChange: boolean): ColumnDef<ChannelTableType>[] => [
  {
    accessorKey: "label",
    header: ({ column }) => <TableSorter isFirst column={column} header="NAME" />,
    cell: ({ row }) => <span className="ps-5 font-medium">{row.original.label}</span>,
  },
  {
    accessorKey: "type",
    header: ({ column }) => <TableSorter column={column} header="TYPE" />,
    cell: ({ row }) => <StatusBadge label={row.original.type.toUpperCase()} tone="blue" />,
  },
  {
    accessorKey: "target",
    header: () => <span className="text-xs">TARGET</span>,
    cell: ({ row }) => <span className="text-muted-foreground line-clamp-1 max-w-xs text-sm">{row.original.target}</span>,
  },
  {
    accessorKey: "credentialLabel",
    header: () => <span className="text-xs">CREDENTIAL</span>,
    cell: ({ row }) => <span className="text-sm">{row.original.credentialLabel ?? "—"}</span>,
  },
  {
    accessorKey: "enabled",
    header: () => <span className="text-xs">ENABLED</span>,
    cell: ({ row }) => <EnabledSwitch id={row.original.id} enabled={row.original.enabled} canChange={canChange} />,
  },
  {
    id: "actions",
    header: () => <span className="text-xs">ACTIONS</span>,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <TestButton id={row.original.id} canChange={canChange} />
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm" className="text-destructive h-7">
              Delete
            </Button>
          }
          title="Delete this channel?"
          description="Alert rules stop notifying through it. This cannot be undone."
          confirmLabel="Delete channel"
          destructive
          successMessage="Channel deleted"
          onConfirm={() => deleteChannel(row.original.id)}
        />
      </div>
    ),
  },
];
