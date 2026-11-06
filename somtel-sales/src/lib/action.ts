import { z } from "zod";
import { ForbiddenError } from "./session";

export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export const initialState: ActionState = {};

export function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Turns thrown errors into a friendly ActionState. Re-throws Next.js redirects. */
export function handleActionError(e: unknown): ActionState {
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
  if (e instanceof ForbiddenError) return { error: e.message };
  if (e instanceof z.ZodError) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(e) };
  if (e instanceof UserError) return { error: e.message, fieldErrors: e.fieldErrors };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

/** An error message that is safe to show to the user. */
export class UserError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

/** Form helpers */
export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export const list = (fd: FormData, k: string) => fd.getAll(k).filter((v): v is string => typeof v === "string" && v !== "");
