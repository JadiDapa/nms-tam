import { ArrowLeftRight, Plus, RefreshCw, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "../StatusBadge";

export type RequestRow = {
  id: number;
  kind: string;
  slots: number | null;
  status: string;
  createdAt: Date;
  adminNote: string | null;
};

const KIND: Record<string, { icon: LucideIcon; title: (r: RequestRow) => string }> = {
  EXTRA_SLOTS: { icon: Plus, title: (r) => `${r.slots ?? 0} extra slot${r.slots === 1 ? "" : "s"}` },
  PLAN_CHANGE: { icon: ArrowLeftRight, title: () => "Plan change" },
  RENEWAL: { icon: RefreshCw, title: () => "Renewal" },
};

const TONE: Record<string, "yellow" | "green" | "gray"> = { OPEN: "yellow", DONE: "green", REJECTED: "gray" };

const SHOWN = 5;

// What the client asked us to change, newest first, with our answer.
export default function RequestsCard({ requests, className }: { requests: RequestRow[]; className?: string }) {
  const open = requests.filter((r) => r.status === "OPEN").length;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-xl">Requests</CardTitle>
        <CardDescription>{open > 0 ? `${open} waiting for us. We will contact you about payment.` : "Changes you asked for and how they went"}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {requests.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">No requests yet. Use the buttons on your plan to ask for more slots, a new plan or a renewal.</p>
        ) : (
          <ul className="divide-border/60 divide-y">
            {requests.slice(0, SHOWN).map((r) => {
              const kind = KIND[r.kind] ?? KIND.RENEWAL;
              const Icon = kind.icon;
              return (
                <li key={r.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="bg-muted text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-full">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{kind.title(r)}</p>
                      <StatusBadge label={r.status} tone={TONE[r.status] ?? "gray"} className="rounded-[6px]" />
                    </div>
                    <p className="text-muted-foreground text-xs">{formatDate(r.createdAt)}</p>
                    {r.adminNote && <p className="bg-muted mt-2 rounded-xl px-3 py-2 text-xs">{r.adminNote}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {requests.length > SHOWN && <p className="text-muted-foreground mt-3 text-center text-xs">+{requests.length - SHOWN} older requests</p>}
      </CardContent>
    </Card>
  );
}
