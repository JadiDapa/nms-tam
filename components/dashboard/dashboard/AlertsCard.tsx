import Link from "next/link";
import { Info, Siren, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { StatusBadge } from "../StatusBadge";

export type AlertRow = {
  id: string;
  title: string;
  deviceName: string;
  severity: string;
  status: string;
  triggeredAt: string;
};

const SEVERITY: Record<string, { icon: LucideIcon; chip: string }> = {
  critical: { icon: Siren, chip: "bg-red-500/10 text-red-600 dark:text-red-500" },
  warning: { icon: TriangleAlert, chip: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500" },
  info: { icon: Info, chip: "bg-blue-500/10 text-blue-600 dark:text-blue-500" },
};

const STATUS_TONE: Record<string, "red" | "yellow" | "green"> = { OPEN: "red", ACKNOWLEDGED: "yellow", RESOLVED: "green" };

const headCell = "text-muted-foreground h-10 px-3 text-xs font-medium first:rounded-l-xl first:pl-4 last:rounded-r-xl last:pr-4";
const bodyCell = "px-3 py-3 first:pl-4 last:pr-4";

// Recent incidents as a compact table: icon chip (colour = severity) + title, time, status.
export default function AlertsCard({ rows, className }: { rows: AlertRow[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-xl">Notifications &amp; Alerts</CardTitle>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link href="/dashboard/incidents">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1">
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">No alerts. Everything looks fine.</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted [&_tr]:border-0">
              <TableRow className="hover:bg-transparent">
                <TableHead className={headCell}>Alert</TableHead>
                <TableHead className={headCell}>When</TableHead>
                <TableHead className={headCell}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const sev = SEVERITY[row.severity] ?? SEVERITY.info;
                const Icon = sev.icon;
                return (
                  <TableRow key={row.id} className="border-border/60">
                    <TableCell className={bodyCell}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", sev.chip)}>
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <Link href={`/dashboard/incidents/${row.id}`} className="block max-w-40 truncate text-sm font-medium hover:underline">
                            {row.title}
                          </Link>
                          <p className="text-muted-foreground max-w-40 truncate text-xs">{row.deviceName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={cn(bodyCell, "text-muted-foreground text-xs whitespace-nowrap")}>{timeAgo(row.triggeredAt)}</TableCell>
                    <TableCell className={bodyCell}>
                      <StatusBadge label={row.status} tone={STATUS_TONE[row.status] ?? "gray"} className="rounded-[6px]" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
