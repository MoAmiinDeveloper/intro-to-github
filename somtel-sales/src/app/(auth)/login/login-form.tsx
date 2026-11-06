"use client";

import Link from "next/link";

import { loginAction } from "../actions";
import { Field, Input } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";

export function LoginForm({ next }: { next: string }) {
  const form = useActionForm(loginAction);
  const state = form.state;
  return (
    <Form form={form} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" pendingText="Signing in...">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-navy hover:underline">
          Forgot your password?
        </Link>
      </p>
    </Form>
  );
}
