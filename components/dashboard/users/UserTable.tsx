"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import DataTable from "../DataTable";
import SearchDataTable from "../SearchDataTable";
import TableSorter from "../TableSorter";
import { StatusBadge } from "../StatusBadge";
import UserRowActions from "./UserRowActions";
import { formatDate } from "@/lib/format";

export interface UserTableType {
  id: number;
  name: string | null;
  email: string;
  role: "USER" | "ADMIN";
  orgId: number | null;
  orgName: string | null;
  joined: boolean;
  active: boolean;
  createdAt: string;
}

export default function UserTable({ users, selfId }: { users: UserTableType[]; selfId: number }) {
  return (
    <DataTable
      columns={userColumns(selfId)}
      data={users}
      title="Users"
      filters={(table) => (
        <div className="grid w-full items-end gap-4 p-4 lg:grid-cols-2 lg:gap-6">
          <SearchDataTable table={table} column="email" placeholder="Search email..." />
          <SearchDataTable table={table} column="orgName" placeholder="Search client..." />
        </div>
      )}
    />
  );
}

const userColumns = (selfId: number): ColumnDef<UserTableType>[] => [
  {
    accessorKey: "email",
    header: ({ column }) => <TableSorter isFirst column={column} header="USER" />,
    cell: ({ row }) => (
      <div className="flex flex-col ps-5 leading-tight">
        <span className="font-medium">{row.original.name || "—"}</span>
        <span className="text-muted-foreground text-xs">{row.original.email}</span>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: ({ column }) => <TableSorter column={column} header="ROLE" />,
    cell: ({ row }) => <StatusBadge label={row.original.role} tone={row.original.role === "ADMIN" ? "blue" : "gray"} />,
  },
  {
    accessorKey: "orgName",
    header: ({ column }) => <TableSorter column={column} header="CLIENT" />,
    cell: ({ row }) =>
      row.original.orgId ? (
        <Link href={`/dashboard/admin/organizations/${row.original.orgId}`} className="text-sm hover:underline">
          {row.original.orgName}
        </Link>
      ) : (
        <span className="text-muted-foreground text-sm">Our staff</span>
      ),
  },
  {
    id: "status",
    header: () => <span className="text-xs">STATUS</span>,
    cell: ({ row }) =>
      !row.original.active ? (
        <StatusBadge label="DEACTIVATED" tone="gray" />
      ) : row.original.joined ? (
        <StatusBadge label="ACTIVE" tone="green" />
      ) : (
        <StatusBadge label="INVITED" tone="yellow" />
      ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <TableSorter column={column} header="ADDED" />,
    cell: ({ row }) => <span className="text-muted-foreground text-xs">{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: "actions",
    header: () => <span className="text-xs">ACTIONS</span>,
    cell: ({ row }) => (
      <UserRowActions userId={row.original.id} joined={row.original.joined} active={row.original.active} isSelf={row.original.id === selfId} />
    ),
  },
];
