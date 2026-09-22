import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBps, formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HistoryRow } from "@/lib/traffic-history";

type Props = { rows: HistoryRow[]; labelFormat: string };

const headCell = "text-muted-foreground h-10 px-3 text-xs font-medium first:rounded-l-xl first:pl-4 last:rounded-r-xl last:pr-4";
const bodyCell = "px-3 py-2.5 first:pl-4 last:pr-4 font-mono text-xs tabular-nums";

// The chart above, broken into rows: same per-bucket averages and volume, just tabular.
export default function TrafficHistoryTable({ rows, labelFormat }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Traffic log</CardTitle>
        <CardDescription>Same data as the chart above, grouped into rows.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">No data in this period.</p>
        ) : (
          <ScrollArea className="bg-muted h-80 rounded-2xl">
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10 [&_tr]:border-0">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={headCell}>Time</TableHead>
                  <TableHead className={headCell}>Inbound (avg)</TableHead>
                  <TableHead className={headCell}>Outbound (avg)</TableHead>
                  <TableHead className={headCell}>Peak</TableHead>
                  <TableHead className={headCell}>Data volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.t} className="border-border/60 bg-card">
                    <TableCell className={bodyCell}>{format(new Date(r.t), labelFormat)}</TableCell>
                    <TableCell className={cn(bodyCell, "text-green-600 dark:text-green-500")}>{formatBps(r.inBps)}</TableCell>
                    <TableCell className={cn(bodyCell, "text-blue-600 dark:text-blue-500")}>{formatBps(r.outBps)}</TableCell>
                    <TableCell className={bodyCell}>{r.peakBps ? formatBps(r.peakBps) : "—"}</TableCell>
                    <TableCell className={cn(bodyCell, "text-muted-foreground")}>{formatBytes(r.volumeBytes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
