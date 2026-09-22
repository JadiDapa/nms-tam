import { CalendarClock, Server, Users, Wallet } from "lucide-react";
import { StatCard, StatGroup } from "../StatCard";
import { formatDate, formatIDR } from "@/lib/format";

type Props = {
  planName: string;
  monthlyCost: number;
  extraSlots: number;
  live: boolean;
  daysLeft: number;
  periodEnd: Date;
  devices: { used: number; limit: number };
  users: { used: number; limit: number };
  className?: string;
};

const usageTone = (pct: number) => (pct >= 100 ? "red" : pct >= 90 ? "yellow" : "green") as "red" | "yellow" | "green";

// The four numbers a client cares about on the billing page, in the same tile panel as the dashboard.
export default function BillingStats({ planName, monthlyCost, extraSlots, live, daysLeft, periodEnd, devices, users, className }: Props) {
  const days = Math.max(0, daysLeft);
  const devicePct = devices.limit > 0 ? Math.round((devices.used / devices.limit) * 100) : 0;
  const userPct = users.limit > 0 ? Math.round((users.used / users.limit) * 100) : 0;

  const renewal = !live
    ? { label: "Expired", tone: "red" as const }
    : days <= 7
      ? { label: "Renew now", tone: "red" as const }
      : days <= 14
        ? { label: "Renew soon", tone: "yellow" as const }
        : { label: "Active", tone: "green" as const };

  return (
    <StatGroup className={className}>
      <StatCard
        featured
        size="md"
        label="Monthly cost"
        value={formatIDR(monthlyCost)}
        icon={Wallet}
        pill={{ label: extraSlots > 0 ? `+${extraSlots} extra slot${extraSlots === 1 ? "" : "s"}` : "Base plan", tone: "green" }}
        caption={planName}
      />
      <StatCard
        label="Days left"
        value={days}
        icon={CalendarClock}
        pill={renewal}
        caption={`${live ? "until" : "ended"} ${formatDate(periodEnd)}`}
      />
      <StatCard
        label="Device slots"
        value={devices.used}
        icon={Server}
        pill={{ label: `${devicePct}% used`, tone: usageTone(devicePct) }}
        caption={`of ${devices.limit} slots`}
      />
      <StatCard
        label="Team members"
        value={users.used}
        icon={Users}
        pill={{ label: `${userPct}% used`, tone: usageTone(userPct) }}
        caption={`of ${users.limit} seats`}
      />
    </StatGroup>
  );
}
