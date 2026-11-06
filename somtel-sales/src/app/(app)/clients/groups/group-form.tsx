"use client";

import Link from "next/link";
import type { ActionState } from "@/lib/action";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Form, FormMessage, SubmitButton, useActionForm } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

type Opt = { id: string; name: string };

export function GroupForm({
  action,
  values,
  sectors,
  owners,
  canAssignOwner,
  cancelHref,
  entityCount = 0,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  values: { id?: string; name?: string; sectorId?: string | null; ownerId?: string | null; notes?: string | null };
  sectors: Opt[];
  owners: Opt[];
  canAssignOwner: boolean;
  cancelHref: string;
  entityCount?: number;
}) {
  const form = useActionForm(action);
  const fe = form.state.fieldErrors ?? {};
  return (
    <Form form={form}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardBody className="space-y-4">
          <FormMessage state={form.state} />
          <Field label="Group name" htmlFor="name" required error={fe.name} help="For example Sahan Group.">
            <Input id="name" name="name" defaultValue={values.name ?? ""} required autoFocus />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Sector" htmlFor="sectorId" help="New entities in the group start with this sector.">
              <Select id="sectorId" name="sectorId" defaultValue={values.sectorId ?? ""}>
                <option value="">Not set</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Account owner" htmlFor="ownerId" help={canAssignOwner ? "New entities in the group start with this owner." : "You are the owner of groups you create."}>
              <Select id="ownerId" name="ownerId" defaultValue={values.ownerId ?? ""} disabled={!canAssignOwner}>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={values.notes ?? ""} />
          </Field>
          {values.id && entityCount > 0 && (
            <Checkbox name="applyToEntities" label={`Also set this sector and owner on all ${entityCount} entities in the group`} />
          )}
          <div className="flex gap-2">
            <SubmitButton>Save group</SubmitButton>
            <Link href={cancelHref} className={buttonClass("outline")}>
              Cancel
            </Link>
          </div>
        </CardBody>
      </Card>
    </Form>
  );
}
