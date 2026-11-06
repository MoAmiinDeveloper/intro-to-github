"use client";

import { saveSettingsAction } from "./actions";
import type { SettingDef, SettingValue } from "@/lib/settings-registry";
import { WEEKDAYS } from "@/lib/settings-registry";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { FormMessage, SubmitButton, Form, useActionForm } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export function SettingsGroupForm({ group, title, defs, values }: { group: string; title: string; defs: SettingDef[]; values: Record<string, SettingValue> }) {
  const form = useActionForm(saveSettingsAction);
  const state = form.state;
  const fe = state.fieldErrors ?? {};
  return (
    <Form form={form}>
      <input type="hidden" name="_group" value={group} />
      <Card>
        <CardHeader title={title} />
        <CardBody className="space-y-4">
          <FormMessage state={state} />
          <div className="grid gap-4 md:grid-cols-2">
            {defs.map((def) => {
              const v = values[def.key];
              const common = { id: def.key, name: def.key };
              const suffix = def.type === "percent" ? "%" : def.type === "money" ? "USD" : def.type === "integer" ? "" : "";
              if (def.type === "boolean")
                return (
                  <div key={def.key} className="md:col-span-2">
                    <Checkbox {...common} label={def.label} defaultChecked={v === true} />
                    {def.help && <p className="ml-6 text-xs text-gray-500">{def.help}</p>}
                  </div>
                );
              if (def.type === "weekdays")
                return (
                  <Field key={def.key} label={def.label} help={def.help} error={fe[def.key]} className="md:col-span-2">
                    <div className="flex flex-wrap gap-4 pt-1">
                      {[6, 0, 1, 2, 3, 4, 5].map((d) => (
                        <Checkbox key={d} name={def.key} value={String(d)} label={WEEKDAYS[d]} defaultChecked={Array.isArray(v) && v.includes(d)} />
                      ))}
                    </div>
                  </Field>
                );
              if (def.type === "select")
                return (
                  <Field key={def.key} label={def.label} htmlFor={def.key} help={def.help} error={fe[def.key]}>
                    <Select {...common} defaultValue={String(v ?? "")}>
                      {def.options!.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                );
              return (
                <Field key={def.key} label={def.label} htmlFor={def.key} help={def.help} error={fe[def.key]}>
                  <div className="flex items-center gap-2">
                    <Input
                      {...common}
                      defaultValue={v === null || v === undefined ? "" : String(v)}
                      inputMode={def.type === "text" ? undefined : "decimal"}
                      placeholder={def.optional ? "Not set" : undefined}
                      className={def.type === "text" ? "" : "w-40"}
                    />
                    {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
                  </div>
                </Field>
              );
            })}
          </div>
          <SubmitButton>Save</SubmitButton>
        </CardBody>
      </Card>
    </Form>
  );
}
