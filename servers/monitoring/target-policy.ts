import dns from "node:dns/promises";
import net from "node:net";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";

// True for addresses a client must not make our servers probe: loopback, private, link-local,
// carrier-grade NAT, multicast and reserved ranges (and the IPv6 equivalents).
export function isPrivateAddress(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const v = ip.toLowerCase();
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      v === "::" ||
      v === "::1" ||
      v.startsWith("fe8") ||
      v.startsWith("fe9") ||
      v.startsWith("fea") ||
      v.startsWith("feb") ||
      v.startsWith("fc") ||
      v.startsWith("fd") ||
      v.startsWith("ff")
    );
  }
  return true; // not an IP at all: treat as unsafe
}

// Called before a client's host is tested or saved. A hostname is resolved and every address it maps to is checked,
// so "internal.example.com -> 10.0.0.5" is refused too.
export async function assertTargetAllowed(host: string): Promise<void> {
  if (config.allowPrivateTargets) return;

  const addresses = net.isIP(host)
    ? [host]
    : await dns
        .lookup(host, { all: true })
        .then((r) => r.map((x) => x.address))
        .catch(() => {
          throw new AppError(`"${host}" cannot be resolved. Check the host name or use its IP address.`);
        });

  if (addresses.some(isPrivateAddress)) {
    throw new AppError(
      "This address is private or reserved. Only devices reachable on a public IP address can be monitored.",
    );
  }
}
