"use client";

import { ColumnDef } from "@tanstack/react-table";

import DataTable from "../DataTable";
import SearchDataTable from "../SearchDataTable";
import TableSorter from "../TableSorter";
import ConfirmAction from "../ConfirmAction";
import CredentialDialog, { CREDENTIAL_TYPE_LABELS } from "./CredentialDialog";
import { StatusBadge } from "../StatusBadge";
import { Button } from "@/components/ui/button";
import { deleteCredential } from "@/app/action/credential.action";
import { formatDateTime } from "@/lib/format";

export interface CredentialTableType {
  id: number;
  label: string;
  type: string;
  updatedAt: string;
}

export default function CredentialTable({ credentials, canChange }: { credentials: CredentialTableType[]; canChange: boolean }) {
  return (
    <DataTable
      columns={credentialColumns(canChange)}
      data={credentials}
      title="Credentials"
      filters={(table) => (
        <div className="grid w-full items-end gap-4 p-4">
          <SearchDataTable table={table} column="label" placeholder="Search credential..." />
        </div>
      )}
    />
  );
}

const credentialColumns = (canChange: boolean): ColumnDef<CredentialTableType>[] => [
  {
    accessorKey: "label",
    header: ({ column }) => <TableSorter isFirst column={column} header="NAME" />,
    cell: ({ row }) => <span className="ps-5 font-medium">{row.original.label}</span>,
  },
  {
    accessorKey: "type",
    header: ({ column }) => <TableSorter column={column} header="TYPE" />,
    cell: ({ row }) => <StatusBadge label={CREDENTIAL_TYPE_LABELS[row.original.type] ?? row.original.type} tone="gray" />,
  },
  {
    id: "secret",
    header: () => <span className="text-xs">SECRET</span>,
    cell: () => <span className="text-muted-foreground text-sm">•••••••• (stored encrypted)</span>,
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => <TableSorter column={column} header="UPDATED" />,
    cell: ({ row }) => <span className="text-muted-foreground text-xs">{formatDateTime(row.original.updatedAt)}</span>,
  },
  {
    id: "actions",
    header: () => <span className="text-xs">ACTIONS</span>,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <CredentialDialog
          existing={{ id: row.original.id, label: row.original.label, type: row.original.type }}
          trigger={
            <Button variant="outline" size="sm" className="h-7" disabled={!canChange}>
              Replace secret
            </Button>
          }
        />
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm" className="text-destructive h-7">
              Delete
            </Button>
          }
          title="Delete this credential?"
          description="This only works when no device or channel uses it."
          confirmLabel="Delete credential"
          destructive
          successMessage="Credential deleted"
          onConfirm={() => deleteCredential(row.original.id)}
        />
      </div>
    ),
  },
];
