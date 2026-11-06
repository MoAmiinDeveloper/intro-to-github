"use client";

import Link from "next/link";

import { saveUserAction } from "../actions";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/roles";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

interface Values {
  id?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  title?: string | null;
  active: boolean;
  managerId?: string | null;
  roles: string[];
  sectorIds: string[];
  techSectionIds: string[];
}

type Opt = { id: string; name: string };

export function UserForm({ values, managers, sectors, techSections }: { values: Values; managers: Opt[]; sectors: Opt[]; techSections: Opt[] }) {
  const form = useActionForm(saveUserAction);
  const state = form.state;
  const fe = state.fieldErrors ?? {};
  return (
    <Form form={form} className="space-y-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <FormMessage state={state} />
      <Card>
        <CardHeader title="Account" />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Full name" htmlFor="name" required error={fe.name}>
            <Input id="name" name="name" defaultValue={values.name ?? ""} required />
          </Field>
          <Field label="Email" htmlFor="email" required error={fe.email}>
            <Input id="email" name="email" type="email" defaultValue={values.email ?? ""} required />
          </Field>
          <Field label="Job title" htmlFor="title">
            <Input id="title" name="title" defaultValue={values.title ?? ""} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={values.phone ?? ""} />
          </Field>
          <Field
            label={values.id ? "Set a new password" : "Password"}
            htmlFor="password"
            required={!values.id}
            error={fe.password}
            help={values.id ? "Leave empty to keep the current password." : "At least 10 characters, letters and numbers. Share it with the user safely."}
          >
            <Input id="password" name="password" type="password" autoComplete="new-password" />
          </Field>
          <Field label="Reports to" htmlFor="managerId" error={fe.managerId}>
            <Select id="managerId" name="managerId" defaultValue={values.managerId ?? ""}>
              <option value="">Nobody</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          {values.id && <Checkbox name="active" label="Account is active (can sign in)" defaultChecked={values.active} className="md:col-span-2" />}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Roles" description="Choose every role this person has." />
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_ROLES.map((r) => (
              <Checkbox key={r} name="roles" value={r} label={ROLE_LABELS[r]} defaultChecked={values.roles.includes(r)} />
            ))}
          </div>
          {fe.roles && <p className="mt-2 text-xs text-red-600">{fe.roles}</p>}
        </CardBody>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader title="Sectors" description="For account managers." />
          <CardBody className="space-y-2">
            {sectors.map((s) => (
              <Checkbox key={s.id} name="sectorIds" value={s.id} label={s.name} defaultChecked={values.sectorIds.includes(s.id)} className="flex" />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Tech sections" description="For Tech Section users." />
          <CardBody className="space-y-2">
            {techSections.length === 0 && <p className="text-sm text-gray-500">No tech sections yet.</p>}
            {techSections.map((t) => (
              <Checkbox key={t.id} name="techSectionIds" value={t.id} label={t.name} defaultChecked={values.techSectionIds.includes(t.id)} className="flex" />
            ))}
            {fe.techSectionIds && <p className="text-xs text-red-600">{fe.techSectionIds}</p>}
          </CardBody>
        </Card>
      </div>
      <div className="flex gap-2">
        <SubmitButton>Save user</SubmitButton>
        <Link href="/settings/users" className={buttonClass("outline")}>
          Cancel
        </Link>
      </div>
    </Form>
  );
}
