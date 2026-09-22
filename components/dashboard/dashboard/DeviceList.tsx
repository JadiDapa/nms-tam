"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown, LayoutGrid, Plus, Rows3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatBps, formatMs, timeAgo } from "@/lib/format";
import { HealthBadge, StatusBadge } from "../StatusBadge";
import { MAP_STATES, STATE_META, type MapState } from "../map/map-types";
import DeviceCard, { Beacon, Meter } from "./DeviceCard";
import Sparkline from "./Sparkline";
import { sortDevices, typeLabel, type DeviceItem, type SortDir, type SortKey } from "./device-list-types";

type View = "grid" | "table";

const headCell = "text-muted-foreground h-10 px-3 text-xs font-medium first:rounded-l-xl first:pl-4 last:rounded-r-xl last:pr-4";
const bodyCell = "px-3 py-3 first:pl-4 last:pr-4";

type Props = {
  devices: DeviceItem[];
  // the "Add device" button: where it goes and what it says (it turns into "Quota full" / "Subscription inactive")
  addHref: string;
  addLabel: string;
  canAdd: boolean;
  initialView?: View;
  title?: string;
  className?: string;
};

export default function DeviceList({ devices, addHref, addLabel, canAdd, initialView = "grid", title = "Devices", className }: Props) {
  const [view, setView] = useState<View>(initialView);
  const [status, setStatus] = useState<"all" | MapState>("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey | null; dir: SortDir }>({ key: null, dir: "asc" });
  const router = useRouter();

  const types = useMemo(() => [...new Set(devices.map((d) => d.deviceType))].sort(), [devices]);

  const q = query.trim().toLowerCase();
  const filtered = devices.filter(
    (d) =>
      (status === "all" || d.state === status) &&
      (type === "all" || d.deviceType === type) &&
      (q === "" || d.name.toLowerCase().includes(q) || d.host.toLowerCase().includes(q)),
  );
  // grid: worst first (the order the data arrives in); table: whatever column the user sorted by
  const shown = view === "table" ? sortDevices(filtered, sort.key, sort.dir) : filtered;

  // none -> ascending -> descending -> none
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : { key: null, dir: "asc" }));

  const sortHead = (label: string, key: SortKey, extra?: string) => {
    const active = sort.key === key;
    const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead className={cn(headCell, extra)} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(key)} className={cn("hover:text-foreground flex items-center gap-1 transition-colors", active && "text-foreground")}>
          {label}
          <Icon className={cn("size-3", !active && "opacity-40")} />
        </button>
      </TableHead>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-4 space-y-0 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>
            Showing {shown.length} of {devices.length} {devices.length === 1 ? "device" : "devices"}
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or address"
              aria-label="Search devices"
              className="w-52 rounded-xl pl-9"
            />
          </div>

          <Select value={status} onValueChange={(v) => setStatus(v as "all" | MapState)}>
            <SelectTrigger className="w-40 rounded-xl" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {MAP_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATE_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-40 rounded-xl capitalize" aria-label="Filter by device type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {typeLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="bg-muted flex rounded-xl p-1" role="group" aria-label="Layout">
            {(
              [
                ["grid", "Grid", LayoutGrid],
                ["table", "Table", Rows3],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  view === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          <Button asChild variant={canAdd ? "default" : "outline"} className="rounded-xl">
            <Link href={addHref}>
              {canAdd && <Plus />}
              {addLabel}
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {devices.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">No devices yet. Add your first device to start monitoring.</p>
        ) : shown.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">No devices match these filters.</p>
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((d) => (
              <DeviceCard key={d.id} device={d} />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted [&_tr]:border-0">
              <TableRow className="hover:bg-transparent">
                {sortHead("Device", "name")}
                {sortHead("Status", "state")}
                <TableHead className={cn(headCell, "hidden xl:table-cell")}>SNMP</TableHead>
                <TableHead className={cn(headCell, "hidden 2xl:table-cell")}>Type</TableHead>
                {sortHead("CPU", "cpu", "hidden md:table-cell")}
                {sortHead("Memory", "memory", "hidden md:table-cell")}
                {sortHead("Latency", "latency")}
                {sortHead("Traffic", "traffic", "hidden sm:table-cell")}
                <TableHead className={cn(headCell, "hidden lg:table-cell")}>Incidents</TableHead>
                {sortHead("Last poll", "lastPoll", "hidden xl:table-cell")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((d) => {
                const paused = d.state === "paused";
                return (
                  <TableRow
                    key={d.id}
                    className={cn("border-border/60 cursor-pointer", paused && "opacity-70")}
                    onClick={() => router.push(`/dashboard/devices/${d.id}`)}
                  >
                    <TableCell className={bodyCell}>
                      <div className="flex min-w-0 items-center gap-3">
                        <Beacon state={d.state} />
                        <div className="min-w-0">
                          <Link href={`/dashboard/devices/${d.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-48 truncate text-sm font-medium hover:underline">
                            {d.name}
                          </Link>
                          <p className="text-muted-foreground truncate font-mono text-xs">{d.host || "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={bodyCell}>
                      <StatusBadge label={d.health} tone={STATE_META[d.state].tone} className="rounded-[6px]" />
                    </TableCell>
                    <TableCell className={cn(bodyCell, "hidden xl:table-cell")}>
                      {d.snmpHealth ? <HealthBadge state={d.snmpHealth} /> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className={cn(bodyCell, "text-muted-foreground hidden text-sm capitalize 2xl:table-cell")}>
                      {[typeLabel(d.deviceType), d.vendor].filter(Boolean).join(" · ")}
                    </TableCell>
                    <TableCell className={cn(bodyCell, "hidden w-40 md:table-cell")}>
                      <Meter label="" pct={paused ? null : d.cpuPct} />
                    </TableCell>
                    <TableCell className={cn(bodyCell, "hidden w-40 md:table-cell")}>
                      <Meter label="" pct={paused ? null : d.memoryPct} />
                    </TableCell>
                    <TableCell className={bodyCell}>
                      <div className="flex items-center gap-3">
                        <span className="w-16 font-mono text-sm tabular-nums">{paused ? "—" : formatMs(d.latencyMs)}</span>
                        <Sparkline values={d.latencySeries} className="hidden w-20 2xl:block" />
                      </div>
                    </TableCell>
                    <TableCell className={cn(bodyCell, "hidden font-mono text-sm whitespace-nowrap tabular-nums sm:table-cell")}>
                      {paused ? "—" : formatBps(d.throughputBps)}
                    </TableCell>
                    <TableCell className={cn(bodyCell, "hidden lg:table-cell")}>
                      {d.incidents > 0 ? (
                        <StatusBadge label={String(d.incidents)} tone="red" className="rounded-[6px]" />
                      ) : (
                        <span className="text-muted-foreground text-xs">0</span>
                      )}
                    </TableCell>
                    <TableCell suppressHydrationWarning className={cn(bodyCell, "text-muted-foreground hidden text-xs whitespace-nowrap xl:table-cell")}>
                      {paused ? "—" : timeAgo(d.lastPollAt)}
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
