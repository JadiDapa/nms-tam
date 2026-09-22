import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Server actions return a result instead of throwing, because Next hides the message of a thrown
// error in production and the user needs to see "Device quota reached" or "Host not allowed".
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    if (err instanceof ZodError) {
      return { ok: false, error: err.issues[0]?.message ?? "Invalid input" };
    }
    console.error(err);
    return { ok: false, error: "Something went wrong" };
  }
}
