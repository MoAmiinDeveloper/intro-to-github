"use client";

import * as React from "react";
import { createContext, startTransition, useActionState, useContext } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button, type ButtonProps } from "./button";
import type { ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";

const PendingContext = createContext(false);

type ServerAction = (state: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Like useActionState, but submits through onSubmit so React does NOT clear the
 * form after each submit. Users keep what they typed when there is an error.
 */
export function useActionForm(action: ServerAction) {
  const [state, dispatch, pending] = useActionState(action, {} as ActionState);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  };
  return { state, pending, onSubmit };
}

export const Form = React.forwardRef<
  HTMLFormElement,
  Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & { form: ReturnType<typeof useActionForm> }
>(function Form({ form, children, ...props }, ref) {
  return (
    <PendingContext.Provider value={form.pending}>
      <form ref={ref} onSubmit={form.onSubmit} noValidate={false} {...props}>
        {children}
      </form>
    </PendingContext.Provider>
  );
});

export function SubmitButton({ children, pendingText = "Saving...", ...props }: ButtonProps & { pendingText?: string }) {
  const status = useFormStatus();
  const ctxPending = useContext(PendingContext);
  const pending = status.pending || ctxPending;
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (state.error)
    return (
      <div className={cn("flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700", className)}>
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{state.error}</span>
      </div>
    );
  if (state.ok && state.message)
    return (
      <div className={cn("flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800", className)}>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{state.message}</span>
      </div>
    );
  return null;
}

/** A button that asks "Are you sure?" before submitting its form. */
export function ConfirmSubmit({ message, ...props }: ButtonProps & { message: string; pendingText?: string }) {
  return (
    <SubmitButton
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    />
  );
}
