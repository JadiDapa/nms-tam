"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import DataTable from "../DataTable";
import SearchDataTable from "../SearchDataTable";
import TableSorter from "../TableSorter";
import { StatusBadge, SubscriptionBadge } from "../StatusBadge";
import { formatDate } from "@/lib/format";

export interface OrganizationTableType {
  id: number;
  name: string;
  orgStatus: "ACTIVE" | "SUSPENDED";
  planName: string | null;
  subscriptionStatus: string;
  devices: number;
  deviceLimit: number;
  users: number;
  paidUntil: string | null;
}

export default function OrganizationTable({ organizations }: { organizations: OrganizationTableType[] }) {
  return (
    <DataTable
      columns={organizationColumns}
      data={organizations}
      title="Clients"
      filters={(table) => (
        <div className="grid w-full items-end gap-4 p-4">
          <SearchDataTable table={table} column="name" placeholder="Search client..." />
        </div>
      )}
    />
  );
}

export const organizationColumns: ColumnDef<OrganizationTableType>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <TableSorter isFirst column={column} header="CLIENT" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2 ps-5">
        <Link href={`/dashboard/admin/organizations/${row.original.id}`} className="font-medium hover:underline">
          {row.original.name}
        </Link>
        {row.original.orgStatus === "SUSPENDED" && <StatusBadge label="SUSPENDED" tone="red" />}
      </div>
    ),
  },
  {
    accessorKey: "planName",
    header: ({ column }) => <TableSorter column={column} header="PLAN" />,
    cell: ({ row }) => <span className="text-sm">{row.original.planName ?? "—"}</span>,
  },
  {
    accessorKey: "subscriptionStatus",
    header: ({ column }) => <TableSorter column={column} header="STATUS" />,
    cell: ({ row }) => <SubscriptionBadge status={row.original.subscriptionStatus} />,
  },
  {
    accessorKey: "devices",
    header: ({ column }) => <TableSorter column={column} header="DEVICES" />,
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.devices} / {row.original.deviceLimit}
      </span>
    ),
  },
  {
    accessorKey: "users",
    header: ({ column }) => <TableSorter column={column} header="USERS" />,
    cell: ({ row }) => <span className="text-sm">{row.original.users}</span>,
  },
  {
    accessorKey: "paidUntil",
    header: ({ column }) => <TableSorter column={column} header="PAID UNTIL" />,
    cell: ({ row }) => <span className="text-sm">{formatDate(row.original.paidUntil)}</span>,
  },
];
