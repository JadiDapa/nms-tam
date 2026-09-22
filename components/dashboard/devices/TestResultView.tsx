import { CheckCircle2, XCircle } from "lucide-react";
import type { EngineTestResult } from "@/servers/engine/engine-types";
import { formatMs, formatPct } from "@/lib/format";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 border-b py-2 text-sm last:border-b-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{children}</span>
  </div>
);

// Shows exactly what the real probes found. Nothing here is estimated.
export default function TestResultView({ result }: { result: EngineTestResult }) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        {result.reachable ? (
          <CheckCircle2 className="size-5 text-green-600" />
        ) : (
          <XCircle className="text-destructive size-5" />
        )}
        <p className="font-medium">
          {result.reachable ? `${result.host} answered` : `${result.host} did not answer`}
          {result.latencyMs !== null && <span className="text-muted-foreground font-normal"> · {formatMs(result.latencyMs)}</span>}
        </p>
      </div>

      <div>
        {result.icmp && (
          <Row label="Ping">
            {result.icmp.reachable
              ? `reply · ${formatMs(result.icmp.avgMs)} · ${formatPct(result.icmp.packetLossPct)} loss`
              : (result.icmp.error ?? "no reply")}
          </Row>
        )}
        {result.tcp?.map((p) => (
          <Row key={p.port} label={`TCP ${p.port}`}>
            {p.status === "open" ? `open · ${formatMs(p.latencyMs)}` : (p.error ?? p.status)}
          </Row>
        ))}
        {result.snmp && (
          <>
            <Row label="SNMP">
              {result.snmp.success ? `answered in ${formatMs(result.snmp.responseMs)}` : (result.snmp.error ?? result.snmp.status)}
            </Row>
            {result.snmp.success && (
              <>
                {result.snmp.system?.sysName && <Row label="Name">{result.snmp.system.sysName}</Row>}
                {result.snmp.system?.sysDescr && (
                  <Row label="Description">
                    <span className="line-clamp-2 max-w-xs text-xs">{result.snmp.system.sysDescr}</span>
                  </Row>
                )}
                <Row label="CPU">{result.snmp.cpu.status === "ok" ? formatPct(result.snmp.cpu.value) : (result.snmp.cpu.error ?? result.snmp.cpu.status)}</Row>
                <Row label="Memory">{result.snmp.memory.status === "ok" ? formatPct(result.snmp.memory.value) : (result.snmp.memory.error ?? result.snmp.memory.status)}</Row>
                <Row label="Interfaces">
                  {result.snmp.interfaces.status === "ok" ? `${result.snmp.interfaces.count} found` : (result.snmp.interfaces.error ?? result.snmp.interfaces.status)}
                </Row>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
