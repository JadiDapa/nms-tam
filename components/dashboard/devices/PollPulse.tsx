"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  // ISO time of the last poll, or null when it never ran
  lastPollAt: string | null;
  intervalSec: number;
  paused: boolean;
};

const R = 9;
const C = 2 * Math.PI * R;

// A small heartbeat: a ring that fills up until the next poll is due. Ticks once a second in the browser only.
export default function PollPulse({ lastPollAt, intervalSec, paused }: Props) {
  // null until mounted, so the server-rendered HTML and the first client render are identical
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (paused) {
    return <span className="text-muted-foreground text-xs">Polling paused</span>;
  }
  if (!lastPollAt || now === null) {
    return <span className="text-muted-foreground text-xs">{lastPollAt ? "…" : "Not polled yet"}</span>;
  }

  const elapsed = Math.max(0, (now - new Date(lastPollAt).getTime()) / 1000);
  const left = Math.round(intervalSec - elapsed);
  const overdue = elapsed > intervalSec * 2 + 5;
  const progress = Math.min(1, elapsed / intervalSec);

  return (
    <span className="text-muted-foreground inline-flex items-center gap-2 text-xs" title={`Polled every ${intervalSec} s`}>
      <svg width="22" height="22" viewBox="0 0 22 22" className="-rotate-90" aria-hidden>
        <circle cx="11" cy="11" r={R} fill="none" strokeWidth="2.5" className="stroke-foreground/10" />
        <circle
          cx="11"
          cy="11"
          r={R}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${progress * C} ${C}`}
          className={cn("transition-[stroke-dasharray] duration-1000 ease-linear", overdue ? "stroke-amber-500" : "stroke-primary")}
        />
      </svg>
      {overdue ? "Poll overdue" : left > 0 ? `Next poll in ${left}s` : "Polling now"}
    </span>
  );
}
