"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { dateKey, PRESET_LABEL, rangeParams, resolveDateRange, type RangePreset, type ResolvedRange } from "@/lib/date-range";

const PRESETS: Exclude<RangePreset, "custom">[] = ["today", "week", "month"];

// Time range control for a chart-heavy page. Presets navigate immediately. Custom ranges only navigate on
// "Apply" — react-day-picker's range mode reports a single click as a complete {from, to: from} selection, so
// closing as soon as both fields are set would end the picker right after the first click, before a second date
// could be chosen.
export default function DateRangePicker({ basePath, current, extra }: { basePath: string; current: ResolvedRange; extra?: Record<string, string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(
    current.preset === "custom" ? { from: current.from, to: current.to } : undefined,
  );

  function go(params: Record<string, string>) {
    const qs = new URLSearchParams({ ...extra, ...params });
    router.push(`${basePath}?${qs.toString()}`);
  }

  function pick(preset: Exclude<RangePreset, "custom">) {
    setOpen(false);
    go(rangeParams(resolveDateRange({ range: preset })));
  }

  function applyCustom() {
    if (!draft?.from) return;
    setOpen(false);
    go({ range: "custom", from: dateKey(draft.from), to: dateKey(draft.to ?? draft.from) });
  }

  function onOpenChange(next: boolean) {
    // Re-sync the draft with the URL's current range each time the popover opens, so a cancelled edit
    // (or navigating here from elsewhere) never leaves a stale partial selection behind.
    if (next) setDraft(current.preset === "custom" ? { from: current.from, to: current.to } : undefined);
    setOpen(next);
  }

  const label =
    current.preset === "custom" ? `${format(current.from, "d MMM yyyy")} – ${format(current.to, "d MMM yyyy")}` : PRESET_LABEL[current.preset];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-lg font-medium">
          <CalendarIcon className="size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex shrink-0 flex-row gap-1 border-b p-2 sm:flex-col sm:border-r sm:border-b-0">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => pick(p)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap transition-colors",
                  current.preset === p ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {PRESET_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="flex flex-col">
            <Calendar mode="range" numberOfMonths={2} selected={draft} onSelect={setDraft} defaultMonth={current.from} disabled={{ after: new Date() }} />
            <div className="flex items-center justify-between gap-2 border-t p-2">
              <p className="text-muted-foreground px-1 text-xs">
                {draft?.from ? `${format(draft.from, "d MMM yyyy")} – ${draft.to ? format(draft.to, "d MMM yyyy") : "?"}` : "Pick a start date"}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={!draft?.from} onClick={applyCustom}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
