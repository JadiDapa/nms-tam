import Link from "next/link";
import { Info, Siren, TriangleAlert, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDateTime, timeAgo } from "@/lib/format";
import { IncidentBadge } from "../StatusBadge";

export type DeviceIncident = {
  id: string;
  severity: string;
  title: string;
  ruleName: string;
  status: string;
  triggeredAt: string;
  resolvedAt: string | null;
};

const SEVERITY: Record<string, { icon: LucideIcon; chip: string }> = {
  critical: { icon: Siren, chip: "bg-red-500/10 text-red-600 dark:text-red-500" },
  warning: { icon: TriangleAlert, chip: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500" },
  info: { icon: Info, chip: "bg-blue-500/10 text-blue-600 dark:text-blue-500" },
};

const headCell = "text-muted-foreground h-10 px-3 text-xs font-medium first:rounded-l-xl first:pl-4 last:rounded-r-xl last:pr-4";
const bodyCell = "px-3 py-3 first:pl-4 last:pr-4";

// Every incident this device has had, newest first.
export default function DeviceIncidents({ incidents }: { incidents: DeviceIncident[] }) {
  const active = incidents.filter((i) => i.status !== "RESOLVED").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Incidents</CardTitle>
        <CardDescription>
          {incidents.length === 0 ? "Nothing has gone wrong on this device." : `${incidents.length} in total, ${active} still active`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {incidents.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">No incidents for this device.</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted [&_tr]:border-0">
              <TableRow className="hover:bg-transparent">
                <TableHead className={headCell}>Incident</TableHead>
                <TableHead className={headCell}>Status</TableHead>
                <TableHead className={headCell}>Started</TableHead>
                <TableHead className={cn(headCell, "hidden md:table-cell")}>Resolved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((i) => {
                const sev = SEVERITY[i.severity] ?? SEVERITY.info;
                const Icon = sev.icon;
                return (
                  <TableRow key={i.id} className="border-border/60">
                    <TableCell className={bodyCell}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", sev.chip)}>
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <Link href={`/dashboard/incidents/${i.id}`} className="block max-w-72 truncate text-sm font-medium hover:underline">
                            {i.title}
                          </Link>
                          <p className="text-muted-foreground max-w-72 truncate text-xs">{i.ruleName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={bodyCell}>
                      <IncidentBadge status={i.status} />
                    </TableCell>
                    <TableCell className={bodyCell}>
                      <p className="text-sm whitespace-nowrap">{timeAgo(i.triggeredAt)}</p>
                      <p className="text-muted-foreground text-xs whitespace-nowrap">{formatDateTime(i.triggeredAt)}</p>
                    </TableCell>
                    <TableCell className={cn(bodyCell, "text-muted-foreground hidden text-sm whitespace-nowrap md:table-cell")}>
                      {i.resolvedAt ? formatDateTime(i.resolvedAt) : "—"}
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
