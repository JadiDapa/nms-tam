import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Radar, Send, Siren, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Stage = {
  icon: LucideIcon;
  title: string;
  text: ReactNode;
  value: number;
  unit: string;
  href?: string;
  // true when there is nothing behind this stage yet
  empty?: boolean;
};

type Props = {
  rules: { total: number; on: number };
  incidents: { last30: number; active: number };
  channels: { total: number; on: number };
  className?: string;
};

function StageRow({ stage, last }: { stage: Stage; last: boolean }) {
  const Icon = stage.icon;
  const body = (
    <div className="hover:bg-card/60 flex items-center gap-4 rounded-2xl p-3 transition-colors">
      <span className={cn("bg-card relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl border", stage.empty && "text-muted-foreground border-dashed")}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium">{stage.title}</p>
        <p className="text-muted-foreground text-sm">{stage.text}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-3xl leading-none font-medium tracking-tight tabular-nums">{stage.value}</p>
        <p className="text-muted-foreground mt-1 text-xs">{stage.unit}</p>
      </div>
      {stage.href && <ChevronRight className="text-muted-foreground size-4 shrink-0" />}
    </div>
  );

  return (
    <li className="relative">
      {/* the line that ties the stages together, running behind the icon tiles */}
      {!last && <span className="border-foreground/20 absolute top-[3.75rem] left-[2.125rem] h-[calc(100%-2.75rem)] border-l border-dashed" aria-hidden />}
      {stage.href ? <Link href={stage.href}>{body}</Link> : body}
    </li>
  );
}

// The journey of an alert in three steps, each with its own count: rules watch, incidents open, channels tell someone.
export default function AlertsFlow({ rules, incidents, channels, className }: Props) {
  const stages: Stage[] = [
    {
      icon: Radar,
      title: "Rules watch your devices",
      text: rules.total === 0 ? "No rule yet, so nothing is being judged." : `${rules.on} switched on, ${rules.total - rules.on} paused`,
      value: rules.total,
      unit: rules.total === 1 ? "rule" : "rules",
      empty: rules.total === 0,
    },
    {
      icon: Siren,
      title: "A problem opens an incident",
      text: incidents.active > 0 ? `${incidents.active} still active right now` : "None active right now",
      value: incidents.last30,
      unit: "in 30 days",
      href: "/dashboard/incidents",
    },
    {
      icon: Send,
      title: "Channels tell your team",
      text: channels.total === 0 ? "Add a channel so someone is notified." : `${channels.on} of ${channels.total} channels switched on`,
      value: channels.total,
      unit: channels.total === 1 ? "channel" : "channels",
      href: "/dashboard/channels",
      empty: channels.total === 0,
    },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-xl">How alerts flow</CardTitle>
        <CardDescription>From a problem on a device to a message to your team</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <ol className="bg-muted flex flex-1 flex-col justify-around gap-2 rounded-2xl p-3">
          {stages.map((s, i) => (
            <StageRow key={s.title} stage={s} last={i === stages.length - 1} />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
