"use client";

import Link from "next/link";

import { forgotPasswordAction } from "../actions";
import { Field, Input } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";

export default function ForgotPasswordPage() {
  const form = useActionForm(forgotPasswordAction);
  const state = form.state;
  return (
    <>
      <h2 className="text-2xl font-semibold text-navy">Forgot password</h2>
      <p className="mb-6 mt-1 text-sm text-gray-500">We will email you a link to set a new password.</p>
      <Form form={form} className="space-y-4">
        <FormMessage state={state} />
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" required autoFocus />
        </Field>
        <SubmitButton className="w-full" pendingText="Sending...">
          Send reset link
        </SubmitButton>
        <p className="text-center text-sm">
          <Link href="/login" className="text-navy hover:underline">
            Back to sign in
          </Link>
        </p>
      </Form>
    </>
  );
}
