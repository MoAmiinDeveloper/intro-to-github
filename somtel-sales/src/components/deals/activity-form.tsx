"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, MessageSquare, Phone, Users } from "lucide-react";
import { logActivityAction } from "@/app/(app)/deals/actions";
import { cn } from "@/lib/utils";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Form, FormMessage, SubmitButton, useActionForm } from "@/components/ui/form";

const TYPES = [
  { key: "CALL", label: "Call", icon: Phone },
  { key: "MEETING", label: "Meeting", icon: Users },
  { key: "EMAIL", label: "Email", icon: Mail },
  { key: "NOTE", label: "Note", icon: MessageSquare },
] as const;

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Quick log of a call, meeting, email or note. On a deal it can also set the next follow-up. */
export function ActivityForm({ dealId, clientId, followUp }: { dealId?: string; clientId?: string; followUp?: string }) {
  const form = useActionForm(logActivityAction);
  const fe = form.state.fieldErrors ?? {};
  const [type, setType] = useState<string>("CALL");
  const [when, setWhen] = useState(localNow);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (form.state.ok) {
      ref.current?.reset();
      setWhen(localNow());
    }
  }, [form.state]);
  const iso = when ? new Date(when).toISOString() : "";
  return (
    <Form form={form} ref={ref} className="space-y-3">
      {dealId && <input type="hidden" name="dealId" value={dealId} />}
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="occurredAtIso" value={iso} />
      <div className="flex flex-wrap gap-1">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", type === t.key ? "bg-navy text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>
      <FormMessage state={form.state} />
      <Field label="What happened" htmlFor="subject" error={fe.subject}>
        <Input id="subject" name="subject" required placeholder="For example: Called the IT manager about the firewall" />
      </Field>
      <Field label="Details" htmlFor="body">
        <Textarea id="body" name="body" className="min-h-[60px]" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="When" htmlFor="occurredAt" error={fe.occurredAt}>
          <Input id="occurredAt" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} max={localNow()} />
        </Field>
        {dealId && (
          <Field label="Next follow-up date" htmlFor="nextFollowUpAt" help="Leave empty to clear the reminder.">
            <Input id="nextFollowUpAt" name="nextFollowUpAt" type="date" defaultValue={followUp ?? ""} />
          </Field>
        )}
      </div>
      {dealId && (
        <Field label="Next step (optional)" htmlFor="nextStep">
          <Input id="nextStep" name="nextStep" />
        </Field>
      )}
      <SubmitButton size="sm">Save</SubmitButton>
    </Form>
  );
}
