import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth";
import DeviceDetail from "@/components/dashboard/devices/DeviceDetail";
import { parseRange } from "@/servers/validators/monitoring.validator";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; range?: string; iface?: string }>;
};

export default async function DevicePage({ params, searchParams }: Props) {
  const { orgId } = await requireClient();
  const { id: rawId } = await params;
  const sp = await searchParams;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  return <DeviceDetail orgId={orgId} id={id} tab={sp.tab} range={parseRange(sp.range)} iface={sp.iface} />;
}
