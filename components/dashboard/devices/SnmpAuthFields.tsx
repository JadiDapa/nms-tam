"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FormField from "../FormField";
import { AUTH_PROTOCOLS, PRIV_PROTOCOLS, SNMP_VERSIONS, type SnmpAuthInput } from "@/servers/validators/monitoring.validator";

type Props = {
  value: SnmpAuthInput | null | undefined;
  onChange: (value: SnmpAuthInput) => void;
  errors?: Partial<Record<keyof SnmpAuthInput, { message?: string }>>;
};

const VERSION_LABELS: Record<(typeof SNMP_VERSIONS)[number], string> = {
  v2c: "SNMP v2c (community)",
  v1: "SNMP v1 (community)",
  v3: "SNMP v3 (user)",
};

// The SNMP login of one device, typed in right where the device is added or edited.
export default function SnmpAuthFields({ value, onChange, errors }: Props) {
  const auth: SnmpAuthInput = value ?? { version: "v2c" };
  const set = (patch: Partial<SnmpAuthInput>) => onChange({ ...auth, ...patch });

  return (
    <div className="space-y-4">
      <FormField label="SNMP version">
        <Select value={auth.version} onValueChange={(v) => set({ version: v as SnmpAuthInput["version"] })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SNMP_VERSIONS.map((v) => (
              <SelectItem key={v} value={v}>
                {VERSION_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {auth.version !== "v3" ? (
        <FormField label="Community string" htmlFor="snmp-community" error={errors?.community?.message}>
          <Input
            id="snmp-community"
            type="password"
            autoComplete="off"
            value={auth.community ?? ""}
            onChange={(e) => set({ community: e.target.value })}
          />
        </FormField>
      ) : (
        <>
          <FormField label="Username" htmlFor="snmp-username" error={errors?.username?.message}>
            <Input id="snmp-username" autoComplete="off" value={auth.username ?? ""} onChange={(e) => set({ username: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Auth protocol" optional>
            <Select value={auth.authProtocol ?? "none"} onValueChange={(v) => set({ authProtocol: v === "none" ? undefined : (v as SnmpAuthInput["authProtocol"]) })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {AUTH_PROTOCOLS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Auth key" htmlFor="snmp-auth-key" optional error={errors?.authKey?.message}>
            <Input id="snmp-auth-key" type="password" autoComplete="off" value={auth.authKey ?? ""} onChange={(e) => set({ authKey: e.target.value })} />
          </FormField>
          <FormField label="Privacy protocol" optional>
            <Select value={auth.privProtocol ?? "none"} onValueChange={(v) => set({ privProtocol: v === "none" ? undefined : (v as SnmpAuthInput["privProtocol"]) })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {PRIV_PROTOCOLS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Privacy key" htmlFor="snmp-priv-key" optional error={errors?.privKey?.message}>
            <Input id="snmp-priv-key" type="password" autoComplete="off" value={auth.privKey ?? ""} onChange={(e) => set({ privKey: e.target.value })} />
          </FormField>
          </div>
        </>
      )}
    </div>
  );
}
