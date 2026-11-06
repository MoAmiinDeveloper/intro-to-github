"use client";

import { use } from "react";
import { resetPasswordAction } from "../../actions";
import { Field, Input } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const form = useActionForm(resetPasswordAction);
  const state = form.state;
  return (
    <>
      <h2 className="text-2xl font-semibold text-navy">Set a new password</h2>
      <p className="mb-6 mt-1 text-sm text-gray-500">At least 10 characters, with letters and numbers.</p>
      <Form form={form} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <FormMessage state={state} />
        <Field label="New password" htmlFor="password" error={state.fieldErrors?.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Repeat new password" htmlFor="confirm" error={state.fieldErrors?.confirm}>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton className="w-full">Save password</SubmitButton>
      </Form>
    </>
  );
}
