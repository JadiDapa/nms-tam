import { AppError } from "@/lib/errors";
import { EngineError } from "./engine-client";

// The engine keeps credential and channel names unique across ALL clients, so every name is prefixed with the
// client's id. Clients only ever see their own label.
export const engineName = (orgId: number, label: string) => `o${orgId}:${label}`;
export const stripEngineName = (orgId: number, name: string) => name.replace(new RegExp(`^o${orgId}:`), "");

// Runs an engine call and turns engine failures into messages that are safe to show to a client.
export async function call<T>(orgId: number | null, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!(err instanceof EngineError)) throw err;
    const strip = (s: string) => (orgId === null ? s : s.replace(new RegExp(`o${orgId}:`, "g"), ""));

    if (err.status === 404) throw new AppError("Not found", 404);
    if (err.status === 409) throw new AppError(strip(err.message), 409);
    if (err.status === 429) throw new AppError("The monitoring service is busy. Try again in a few seconds.", 429);
    if (err.status === 400) {
      const details = Array.isArray(err.details)
        ? (err.details as Array<{ path?: string; message?: string }>).map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)).join("; ")
        : "";
      throw new AppError(strip(details ? `${err.message} (${details})` : err.message));
    }
    console.error("engine error", err.status, err.code, err.message);
    throw new AppError("The monitoring service is unavailable right now. Please try again shortly.", 503);
  }
}
