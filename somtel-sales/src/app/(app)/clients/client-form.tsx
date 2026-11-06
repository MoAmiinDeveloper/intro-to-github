"use client";

import Link from "next/link";
import { useState } from "react";

import type { ActionState } from "@/lib/action";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export interface ClientFormValues {
  id?: string;
  name?: string;
  groupId?: string | null;
  sectorId?: string | null;
  industry?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  status?: string;
  ownerId?: string | null;
  notes?: string | null;
  upsellNotes?: string | null;
}

export function ClientForm({
  action,
  values,
  sectors,
  owners,
  groups,
  canAssignOwner,
  cancelHref,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  values: ClientFormValues;
  sectors: { id: string; name: string }[];
  groups: { id: string; name: string; sectorId: string | null; ownerId: string | null }[];
  owners: { id: string; name: string }[];
  canAssignOwner: boolean;
  cancelHref: string;
}) {
  const form = useActionForm(action);
  const state = form.state;
  const fe = state.fieldErrors ?? {};
  const [groupId, setGroupId] = useState(values.groupId ?? "");
  const [sectorId, setSectorId] = useState(values.sectorId ?? "");
  const [ownerId, setOwnerId] = useState(values.ownerId ?? "");
  const onGroupChange = (id: string) => {
    setGroupId(id);
    const g = groups.find((x) => x.id === id);
    // Copy the group's defaults. The user can still change them.
    if (g?.sectorId) setSectorId(g.sectorId);
    if (g?.ownerId && canAssignOwner && owners.some((o) => o.id === g.ownerId)) setOwnerId(g.ownerId);
  };
  return (
    <Form form={form}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardBody className="space-y-5">
          <FormMessage state={state} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Entity name" htmlFor="name" required error={fe.name} help="The legal company name used on quotes and contracts.">
              <Input id="name" name="name" defaultValue={values.name ?? ""} required autoFocus />
            </Field>
            <Field label="Group" htmlFor="groupId" error={fe.groupId} help="Optional. Choosing a group copies its sector and owner.">
              <Select id="groupId" name="groupId" value={groupId} onChange={(e) => onGroupChange(e.target.value)}>
                <option value="">No group (standalone)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sector" htmlFor="sectorId" error={fe.sectorId}>
              <Select id="sectorId" name="sectorId" value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
                <option value="">Not set</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Industry" htmlFor="industry" error={fe.industry}>
              <Input id="industry" name="industry" defaultValue={values.industry ?? ""} placeholder="For example Banking, NGO, Logistics" />
            </Field>
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue={values.status ?? "PROSPECT"}>
                <option value="PROSPECT">Prospect</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </Field>
            <Field
              label="Account owner"
              htmlFor="ownerId"
              error={fe.ownerId}
              help={canAssignOwner ? undefined : "You are the owner of entities you create."}
            >
              <Select id="ownerId" name="ownerId" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={!canAssignOwner}>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Address" htmlFor="address" error={fe.address}>
              <Input id="address" name="address" defaultValue={values.address ?? ""} />
            </Field>
            <Field label="City" htmlFor="city" error={fe.city}>
              <Input id="city" name="city" defaultValue={values.city ?? ""} placeholder="Hargeisa" />
            </Field>
            <Field label="Phone" htmlFor="phone" error={fe.phone}>
              <Input id="phone" name="phone" defaultValue={values.phone ?? ""} />
            </Field>
            <Field label="Email" htmlFor="email" error={fe.email}>
              <Input id="email" name="email" type="email" defaultValue={values.email ?? ""} />
            </Field>
            <Field label="Website" htmlFor="website" error={fe.website}>
              <Input id="website" name="website" defaultValue={values.website ?? ""} />
            </Field>
            <Field label="Notes" htmlFor="notes" className="md:col-span-2">
              <Textarea id="notes" name="notes" defaultValue={values.notes ?? ""} />
            </Field>
            <Field label="Upsell and cross-sell notes" htmlFor="upsellNotes" className="md:col-span-2">
              <Textarea id="upsellNotes" name="upsellNotes" defaultValue={values.upsellNotes ?? ""} />
            </Field>
          </div>
          <div className="flex gap-2">
            <SubmitButton>Save entity</SubmitButton>
            <Link href={cancelHref} className={buttonClass("outline")}>
              Cancel
            </Link>
          </div>
        </CardBody>
      </Card>
    </Form>
  );
}
