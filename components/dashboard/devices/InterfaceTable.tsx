"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, LayoutGrid, Rows3, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "../StatusBadge";
import { setInterfaceMonitored } from "@/app/action/device.action";
import type { EngineInterface } from "@/servers/engine/engine-types";
import { formatBps, timeAgo } from "@/lib/format";
import { parsePortFamily } from "@/lib/port-family";
import { cn } from "@/lib/utils";

type Props = {
  deviceId: number;
  interfaces: EngineInterface[];
  selected?: string;
  canChange: boolean;
  range: string;
};

type View = "grid" | "table";

const headCell = "text-muted-foreground h-10 px-3 text-xs font-medium first:rounded-l-xl first:pl-4 last:rounded-r-xl last:pr-4";
const bodyCell = "px-3 py-3 first:pl-4 last:pr-4";

const statusTone = (s: string | null) => (s === "up" ? "green" : s === "down" ? "red" : "gray");

export default function InterfaceTable({ deviceId, interfaces, selected, canChange, range }: Props) {
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const [view, setView] = useState<View>("grid");
  const router = useRouter();

  function toggle(id: string, monitored: boolean) {
    startTransition(async () => {
      const r = await setInterfaceMonitored(deviceId, id, monitored);
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });
  }

  if (interfaces.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-muted-foreground py-10 text-center text-sm">No interfaces found yet. They appear after the first successful SNMP poll.</p>
        </CardContent>
      </Card>
    );
  }

  // Which port family (ether, sfpplus, vlan, ...) each interface belongs to, and how many there are of each.
  const familyCounts = new Map<string, number>();
  for (const i of interfaces) {
    const f = parsePortFamily(i.name).family;
    familyCounts.set(f, (familyCounts.get(f) ?? 0) + 1);
  }
  const families = [...familyCounts.entries()].sort(([a], [b]) => a.localeCompare(b));

  const q = query.trim().toLowerCase();
  const shown = interfaces.filter(
    (i) =>
      (q === "" || i.name.toLowerCase().includes(q) || (i.alias ?? "").toLowerCase().includes(q)) &&
      (family === "all" || parsePortFamily(i.name).family === family),
  );
  const monitored = interfaces.filter((i) => i.monitored).length;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl">Interfaces</CardTitle>
          <CardDescription>
            {monitored} of {interfaces.length} monitored. Switch monitoring off for ports you do not need.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search interface" aria-label="Search interfaces" className="w-full rounded-xl pl-9 sm:w-56" />
          </div>
          <div className="bg-muted inline-flex shrink-0 rounded-lg p-1" role="group" aria-label="Layout">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              title="Card grid"
              className={cn("rounded-md p-1.5 transition-colors", view === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              title="Table"
              className={cn("rounded-md p-1.5 transition-colors", view === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <Rows3 className="size-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {families.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by port type">
            <button
              onClick={() => setFamily("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                family === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              All ({interfaces.length})
            </button>
            {families.map(([f, count]) => (
              <button
                key={f}
                onClick={() => setFamily(f)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium uppercase transition-colors",
                  family === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {f} ({count})
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">No interface matches.</p>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((i) => (
              <PortCard key={i.id} deviceId={deviceId} i={i} selected={selected === i.id} canChange={canChange} range={range} onToggle={toggle} />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted [&_tr]:border-0">
              <TableRow className="hover:bg-transparent">
                <TableHead className={headCell}>Interface</TableHead>
                <TableHead className={headCell}>Status</TableHead>
                <TableHead className={cn(headCell, "hidden md:table-cell")}>Speed</TableHead>
                <TableHead className={headCell}>Traffic</TableHead>
                <TableHead className={cn(headCell, "hidden lg:table-cell")}>Errors</TableHead>
                <TableHead className={headCell}>Monitored</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((i) => (
                <TableRow key={i.id} className={cn("border-border/60", !i.active && "opacity-60", selected === i.id && "bg-muted")}>
                  <TableCell className={bodyCell}>
                    <Link
                      href={`/dashboard/devices/${deviceId}?tab=interfaces&iface=${i.id}&range=${range}`}
                      className="block max-w-52 truncate text-sm font-medium hover:underline"
                    >
                      {i.name}
                    </Link>
                    <p className="text-muted-foreground max-w-52 truncate text-xs">
                      {i.active ? (i.alias ?? i.type ?? "") : `not seen since ${timeAgo(i.inactiveSince)}`}
                    </p>
                  </TableCell>
                  <TableCell className={bodyCell}>
                    {i.active ? (
                      <div className="flex items-center gap-1.5">
                        <StatusBadge label={(i.operStatus ?? "?").toUpperCase()} tone={statusTone(i.operStatus)} />
                        {i.adminStatus === "down" && <span className="text-muted-foreground text-[11px]">disabled</span>}
                      </div>
                    ) : (
                      <StatusBadge label="INACTIVE" tone="gray" />
                    )}
                  </TableCell>
                  <TableCell className={cn(bodyCell, "text-muted-foreground hidden font-mono text-sm tabular-nums md:table-cell")}>{formatBps(i.speedBps)}</TableCell>
                  <TableCell className={bodyCell}>
                    {i.latest ? (
                      <div className="space-y-0.5 font-mono text-xs tabular-nums">
                        <p className="flex items-center gap-1">
                          <ArrowDown className="text-muted-foreground size-3" />
                          {formatBps(i.latest.inBps)}
                        </p>
                        <p className="flex items-center gap-1">
                          <ArrowUp className="text-muted-foreground size-3" />
                          {formatBps(i.latest.outBps)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(bodyCell, "text-muted-foreground hidden font-mono text-xs lg:table-cell")}>
                    {i.latest ? `${i.latest.inErrors ?? "—"} / ${i.latest.outErrors ?? "—"}` : "—"}
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Switch checked={i.monitored} disabled={!canChange} onCheckedChange={(v) => toggle(i.id, v)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PortCard({
  deviceId,
  i,
  selected,
  canChange,
  range,
  onToggle,
}: {
  deviceId: number;
  i: EngineInterface;
  selected: boolean;
  canChange: boolean;
  range: string;
  onToggle: (id: string, monitored: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "bg-muted flex flex-col gap-3 rounded-2xl p-3.5 transition-shadow",
        selected && "ring-primary ring-2 ring-offset-2 ring-offset-background",
        !i.active && "opacity-60",
      )}
    >
      <Link href={`/dashboard/devices/${deviceId}?tab=interfaces&iface=${i.id}&range=${range}`} className="group flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium group-hover:underline">{i.name}</p>
          <p className="text-muted-foreground truncate text-[11px]">
            {i.active ? (i.alias ?? i.type ?? "—") : `not seen since ${timeAgo(i.inactiveSince)}`}
          </p>
        </div>
        {i.active ? (
          <StatusBadge label={(i.operStatus ?? "?").toUpperCase()} tone={statusTone(i.operStatus)} />
        ) : (
          <StatusBadge label="OFF" tone="gray" />
        )}
      </Link>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground font-mono">{formatBps(i.speedBps)}</span>
        {i.latest ? (
          <div className="flex items-center gap-2 font-mono tabular-nums">
            <span className="flex items-center gap-0.5 text-green-600 dark:text-green-500">
              <ArrowDown className="size-3" />
              {formatBps(i.latest.inBps)}
            </span>
            <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-500">
              <ArrowUp className="size-3" />
              {formatBps(i.latest.outBps)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      <div className="border-border/60 flex items-center justify-between border-t pt-2.5">
        <span className="text-muted-foreground text-[11px]">Monitored</span>
        <Switch checked={i.monitored} disabled={!canChange} onCheckedChange={(v) => onToggle(i.id, v)} />
      </div>
    </div>
  );
}
