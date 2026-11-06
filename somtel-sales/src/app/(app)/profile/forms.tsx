"use client";

import { useEffect, useRef } from "react";
import { changePasswordAction, updateProfileAction } from "./actions";
import { Field, Input } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";

export function ProfileForm({ values }: { values: { name: string; phone: string | null; title: string | null; email: string } }) {
  const form = useActionForm(updateProfileAction);
  const state = form.state;
  return (
    <Form form={form} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Email" help="Ask an Admin to change your email.">
        <Input value={values.email} disabled />
      </Field>
      <Field label="Full name" htmlFor="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" defaultValue={values.name} required />
      </Field>
      <Field label="Job title" htmlFor="title">
        <Input id="title" name="title" defaultValue={values.title ?? ""} />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <Input id="phone" name="phone" defaultValue={values.phone ?? ""} />
      </Field>
      <SubmitButton>Save</SubmitButton>
    </Form>
  );
}

export function PasswordForm() {
  const form = useActionForm(changePasswordAction);
  const state = form.state;
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const fe = state.fieldErrors ?? {};
  return (
    <Form ref={ref} form={form} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Current password" htmlFor="current" error={fe.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="password" error={fe.password} help="At least 10 characters, letters and numbers.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Repeat new password" htmlFor="confirm" error={fe.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton>Change password</SubmitButton>
    </Form>
  );
}
