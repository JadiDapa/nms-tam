import Link from "next/link";
import { cn } from "@/lib/utils";
import { RANGES, type RangeKey } from "@/servers/validators/monitoring.validator";

// Time range picker for charts. It is plain links (?range=...), so the server page just renders with the new range.
export default function RangeTabs({ basePath, current, extra }: { basePath: string; current: RangeKey; extra?: Record<string, string> }) {
  return (
    <div className="bg-muted inline-flex rounded-lg p-1 text-sm" role="group" aria-label="Time range">
      {(Object.keys(RANGES) as RangeKey[]).map((key) => {
        const qs = new URLSearchParams({ ...extra, range: key });
        return (
          <Link
            key={key}
            href={`${basePath}?${qs.toString()}`}
            aria-current={key === current ? "true" : undefined}
            title={`Last ${RANGES[key].label}`}
            className={cn(
              "rounded-md px-3 py-1 font-medium transition-colors",
              key === current ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {key}
          </Link>
        );
      })}
    </div>
  );
}
