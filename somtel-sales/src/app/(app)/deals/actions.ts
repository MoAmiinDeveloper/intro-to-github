"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit, changedFields } from "@/lib/audit";
import { type ActionState, UserError, handleActionError, optStr, str } from "@/lib/action";
import { ForbiddenError, assertPermission, getCurrentUser, type CurrentUser } from "@/lib/session";
import { clientScope } from "@/lib/clients";
import { assignableOwnerIds, canEditDeal } from "@/lib/deals";
import { moveDeal, valuesFromLines } from "@/lib/pipeline";

const money = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : v.trim() === "" ? 0 : Number(v.replace(/,/g, ""))))
    .refine((n) => Number.isFinite(n) && n >= 0 && n < 1e12, `${label} must be a number of 0 or more.`);

const dateOrNull = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => s === "" || /^\d{4}-\d{2}-\d{2}$/.test(s), "Enter a valid date.")
  .transform((s) => (s === "" ? null : new Date(`${s}T00:00:00Z`)));

const lineSchema = z.object({
  planId: z.string().nullable().optional(),
  subProductId: z.string().nullable().optional(),
  description: z.string().trim().min(1, "Each product line needs a description.").max(300),
  quantity: money("Quantity").refine((n) => n > 0, "Quantity must be more than 0."),
  oneTimeValue: money("One-time value"),
  monthlyValue: money("Monthly value"),
});

const dealSchema = z.object({
  title: z.string().trim().min(3, "Enter a short title, for example 'Firewall for head office'.").max(200),
  clientId: z.string().min(1, "Choose the entity."),
  productType: z.enum(["IT", "NON_IT", "TRACKING"], { message: "Choose the product type." }),
  oneTimeValue: money("One-time value"),
  monthlyValue: money("Monthly value"),
  expectedCloseDate: dateOrNull,
  nextFollowUpAt: dateOrNull,
  nextStep: z.string().max(300).nullable(),
  ownerId: z.string().nullable(),
  probability: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s === "" || (/^\d+$/.test(s) && Number(s) <= 100), "Probability must be a whole number from 0 to 100.")
    .transform((s) => (s === "" ? null : Number(s))),
});

function readLines(fd: FormData) {
  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "lines") || "[]");
  } catch {
    throw new UserError("The product lines could not be read.");
  }
  const parsed = z.array(lineSchema).max(100).safeParse(raw);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]!.message, { lines: parsed.error.issues[0]!.message });
  return parsed.data;
}

async function checkLineRefs(lines: z.infer<typeof lineSchema>[]) {
  const planIds = lines.map((l) => l.planId).filter((x): x is string => !!x);
  const subIds = lines.map((l) => l.subProductId).filter((x): x is string => !!x);
  const [plans, subs] = await Promise.all([
    planIds.length ? prisma.plan.count({ where: { id: { in: planIds }, deletedAt: null } }) : 0,
    subIds.length ? prisma.itSubProduct.count({ where: { id: { in: subIds }, deletedAt: null } }) : 0,
  ]);
  if (plans !== new Set(planIds).size || subs !== new Set(subIds).size) throw new UserError("One of the products no longer exists. Please choose it again.");
}

async function checkClient(user: CurrentUser, clientId: string) {
  const client = await prisma.client.findFirst({ where: { AND: [{ id: clientId, deletedAt: null }, await clientScope(user)] } });
  if (!client) throw new UserError("Choose an entity you can see.", { clientId: "Choose an entity you can see." });
  return client;
}

async function resolveOwner(user: CurrentUser, wanted: string | null, fallback: string) {
  const ownerId = wanted ?? fallback;
  const allowed = await assignableOwnerIds(user);
  if (allowed !== "all" && !allowed.includes(ownerId)) return allowed.includes(fallback) ? fallback : user.id;
  const owner = await prisma.user.findFirst({ where: { id: ownerId, active: true, deletedAt: null } });
  if (!owner) throw new UserError("Choose an active user as owner.", { ownerId: "Choose an active user." });
  return ownerId;
}

function lineRows(lines: z.infer<typeof lineSchema>[]) {
  return lines.map((l, i) => ({
    planId: l.planId || null,
    subProductId: l.subProductId || null,
    description: l.description,
    quantity: new Prisma.Decimal(l.quantity),
    oneTimeValue: new Prisma.Decimal(l.oneTimeValue),
    monthlyValue: new Prisma.Decimal(l.monthlyValue),
    sortOrder: i,
  }));
}

function readDeal(fd: FormData) {
  return {
    title: str(fd, "title"),
    clientId: str(fd, "clientId"),
    productType: str(fd, "productType"),
    oneTimeValue: str(fd, "oneTimeValue"),
    monthlyValue: str(fd, "monthlyValue"),
    expectedCloseDate: str(fd, "expectedCloseDate"),
    nextFollowUpAt: str(fd, "nextFollowUpAt"),
    nextStep: optStr(fd, "nextStep"),
    ownerId: optStr(fd, "ownerId"),
    probability: str(fd, "probability"),
  };
}

export async function createDealAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const user = await assertPermission("deals.create");
    const data = dealSchema.parse(readDeal(fd));
    const lines = readLines(fd);
    await checkLineRefs(lines);
    const client = await checkClient(user, data.clientId);
    const ownerId = await resolveOwner(user, data.ownerId, user.id);
    const stage = await prisma.pipelineStage.findFirst({ where: { id: str(fd, "stageId") || undefined, active: true, kind: "OPEN" }, orderBy: { sortOrder: "asc" } });
    if (!stage) throw new UserError("There is no active open pipeline stage. Ask an Admin to check Settings.");
    const values = lines.length ? valuesFromLines(lines) : { oneTimeValue: data.oneTimeValue, monthlyValue: data.monthlyValue };
    const deal = await prisma.$transaction(async (tx) => {
      const d = await tx.deal.create({
        data: {
          title: data.title,
          clientId: client.id,
          productType: data.productType,
          stageId: stage.id,
          probability: data.probability ?? stage.probability,
          oneTimeValue: new Prisma.Decimal(values.oneTimeValue),
          monthlyValue: new Prisma.Decimal(values.monthlyValue),
          expectedCloseDate: data.expectedCloseDate,
          nextFollowUpAt: data.nextFollowUpAt,
          nextStep: data.nextStep,
          ownerId,
          createdById: user.id,
          products: { create: lineRows(lines) },
        },
      });
      await tx.dealStageChange.create({ data: { dealId: d.id, toStageId: stage.id, changedById: user.id } });
      await audit(tx, { userId: user.id, action: "CREATE", entityType: "Deal", entityId: d.id, summary: `Created deal ${d.title} for ${client.name}`, after: d });
      return d;
    });
    id = deal.id;
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath("/pipeline");
  redirect(`/deals/${id}`);
}

async function editableDeal(dealId: string) {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Please sign in again.");
  const deal = await prisma.deal.findFirst({ where: { id: dealId, deletedAt: null }, include: { stage: true, client: { select: { id: true, name: true } } } });
  if (!deal || !(await canEditDeal(user, deal))) throw new ForbiddenError();
  return { user, deal };
}

export async function updateDealAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  try {
    const { user, deal } = await editableDeal(id);
    const data = dealSchema.parse(readDeal(fd));
    const lines = readLines(fd);
    await checkLineRefs(lines);
    const client = data.clientId === deal.clientId ? deal.client : await checkClient(user, data.clientId);
    const ownerId = await resolveOwner(user, data.ownerId, deal.ownerId);
    const values = lines.length ? valuesFromLines(lines) : { oneTimeValue: data.oneTimeValue, monthlyValue: data.monthlyValue };
    await prisma.$transaction(async (tx) => {
      const beforeLines = await tx.dealProduct.findMany({ where: { dealId: id }, orderBy: { sortOrder: "asc" } });
      const after = await tx.deal.update({
        where: { id },
        data: {
          title: data.title,
          clientId: client.id,
          productType: data.productType,
          probability: data.probability ?? deal.probability,
          oneTimeValue: new Prisma.Decimal(values.oneTimeValue),
          monthlyValue: new Prisma.Decimal(values.monthlyValue),
          expectedCloseDate: data.expectedCloseDate,
          nextFollowUpAt: data.nextFollowUpAt,
          nextStep: data.nextStep,
          ownerId,
        },
      });
      await tx.dealProduct.deleteMany({ where: { dealId: id } });
      if (lines.length) await tx.dealProduct.createMany({ data: lineRows(lines).map((l) => ({ ...l, dealId: id })) });
      const snap = (ls: { description: string; quantity: unknown; oneTimeValue: unknown; monthlyValue: unknown }[]) =>
        ls.map((l) => `${l.description} x${Number(l.quantity)}: ${Number(l.oneTimeValue)} one-time, ${Number(l.monthlyValue)} monthly`);
      const diff = changedFields({ ...deal, products: snap(beforeLines) }, { ...after, products: snap(lines) });
      if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: "Deal", entityId: id, summary: `Updated deal ${after.title}`, before: diff.before, after: diff.after });
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath(`/deals/${id}`);
  redirect(`/deals/${id}`);
}

/** Move a deal to another stage (from the board or the deal page). */
export async function moveDealAction(input: { dealId: string; stageId: string; lostReasonId?: string | null; lostNote?: string | null }): Promise<ActionState> {
  try {
    const { user, deal } = await editableDeal(input.dealId);
    const to = await prisma.pipelineStage.findFirst({ where: { id: input.stageId, active: true } });
    if (!to) throw new UserError("That stage no longer exists.");
    const lostReason = input.lostReasonId ? await prisma.lostReason.findFirst({ where: { id: input.lostReasonId, active: true } }) : null;
    const now = new Date();
    const res = moveDeal({
      current: { stageId: deal.stageId, stageKind: deal.stage.kind, wonAt: deal.wonAt, lostAt: deal.lostAt },
      to: { id: to.id, kind: to.kind, probability: to.probability },
      lostReason,
      lostNote: input.lostNote,
      now,
    });
    if (!res.ok) return { error: res.error, fieldErrors: res.field ? { [res.field]: res.error } : undefined };
    if (!res.changed) return { ok: true };
    await prisma.$transaction(async (tx) => {
      await tx.deal.update({ where: { id: deal.id }, data: res.data });
      await tx.dealStageChange.create({ data: { dealId: deal.id, fromStageId: deal.stageId, toStageId: to.id, changedById: user.id, changedAt: now } });
      const reason = to.kind === "LOST" && lostReason ? ` (${lostReason.name}${res.data.lostNote ? `: ${res.data.lostNote}` : ""})` : "";
      await tx.activity.create({
        data: { type: "STAGE_CHANGE", clientId: deal.clientId, dealId: deal.id, userId: user.id, occurredAt: now, subject: `Moved from ${deal.stage.name} to ${to.name}${reason}` },
      });
      await audit(tx, {
        userId: user.id,
        action: "STAGE_CHANGE",
        entityType: "Deal",
        entityId: deal.id,
        summary: `Moved deal ${deal.title} from ${deal.stage.name} to ${to.name}${reason}`,
        before: { stage: deal.stage.name, probability: deal.probability },
        after: { stage: to.name, probability: res.data.probability, lostReason: lostReason?.name ?? null, lostNote: res.data.lostNote },
      });
    });
    revalidatePath("/pipeline");
    revalidatePath(`/deals/${deal.id}`);
    return { ok: true, message: `Moved to ${to.name}.` };
  } catch (e) {
    return handleActionError(e);
  }
}

/** Form wrapper for the move action (deal page). */
export async function moveDealFormAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return moveDealAction({ dealId: str(fd, "dealId"), stageId: str(fd, "stageId"), lostReasonId: optStr(fd, "lostReasonId"), lostNote: optStr(fd, "lostNote") });
}

const activitySchema = z.object({
  type: z.enum(["CALL", "MEETING", "EMAIL", "NOTE"]),
  subject: z.string().trim().min(2, "Write what happened, for example 'Called the IT manager'.").max(200),
  body: z.string().max(5000).nullable(),
  occurredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Enter the date and time.")
    .transform((s) => new Date(s)),
  nextFollowUpAt: dateOrNull,
  nextStep: z.string().max(300).nullable(),
});

/** Log a call, meeting, email or note on a deal (or directly on an entity). */
export async function logActivityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const dealId = str(fd, "dealId");
  const clientIdParam = str(fd, "clientId");
  try {
    const user = await getCurrentUser();
    if (!user) throw new ForbiddenError("Please sign in again.");
    // The time is sent from the browser with its UTC offset so it is stored correctly.
    const data = activitySchema.parse({
      type: str(fd, "type"),
      subject: str(fd, "subject"),
      body: optStr(fd, "body"),
      occurredAt: str(fd, "occurredAtIso") || str(fd, "occurredAt"),
      nextFollowUpAt: str(fd, "nextFollowUpAt"),
      nextStep: optStr(fd, "nextStep"),
    });
    if (data.occurredAt.getTime() > Date.now() + 5 * 60_000) throw new UserError("The activity time cannot be in the future. Use the follow-up date for planned work.", { occurredAt: "Cannot be in the future." });

    if (dealId) {
      const { deal } = await editableDeal(dealId);
      await prisma.$transaction(async (tx) => {
        const a = await tx.activity.create({
          data: { type: data.type, subject: data.subject, body: data.body, occurredAt: data.occurredAt, clientId: deal.clientId, dealId: deal.id, userId: user.id },
        });
        const latest = data.occurredAt > deal.lastActivityAt ? data.occurredAt : deal.lastActivityAt;
        const followUpChanged = fd.has("nextFollowUpAt");
        await tx.deal.update({
          where: { id: deal.id },
          data: {
            lastActivityAt: latest,
            ...(followUpChanged ? { nextFollowUpAt: data.nextFollowUpAt } : {}),
            ...(data.nextStep ? { nextStep: data.nextStep } : {}),
          },
        });
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "Activity", entityId: a.id, summary: `Logged ${data.type.toLowerCase()} on deal ${deal.title}`, after: a });
      });
      revalidatePath(`/deals/${deal.id}`);
    } else {
      const client = await prisma.client.findFirst({ where: { AND: [{ id: clientIdParam, deletedAt: null }, await clientScope(user)] } });
      if (!client) throw new ForbiddenError();
      await prisma.$transaction(async (tx) => {
        const a = await tx.activity.create({ data: { type: data.type, subject: data.subject, body: data.body, occurredAt: data.occurredAt, clientId: client.id, userId: user.id } });
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "Activity", entityId: a.id, summary: `Logged ${data.type.toLowerCase()} with ${client.name}`, after: a });
      });
      revalidatePath(`/clients/${client.id}`);
    }
    revalidatePath("/follow-ups");
    revalidatePath("/pipeline");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return handleActionError(e);
  }
}

/** Quick change of the next follow-up date (from the follow-ups list). */
export async function setFollowUpAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, deal } = await editableDeal(str(fd, "dealId"));
    const next = dateOrNull.parse(str(fd, "nextFollowUpAt"));
    await prisma.$transaction(async (tx) => {
      await tx.deal.update({ where: { id: deal.id }, data: { nextFollowUpAt: next } });
      await audit(tx, {
        userId: user.id,
        action: "UPDATE",
        entityType: "Deal",
        entityId: deal.id,
        summary: `Follow-up for ${deal.title} ${next ? `set to ${next.toISOString().slice(0, 10)}` : "cleared"}`,
        before: { nextFollowUpAt: deal.nextFollowUpAt },
        after: { nextFollowUpAt: next },
      });
    });
    revalidatePath("/follow-ups");
    revalidatePath(`/deals/${deal.id}`);
    return { ok: true, message: "Follow-up updated." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function deleteDealAction(fd: FormData) {
  const { user, deal } = await editableDeal(str(fd, "id"));
  await prisma.$transaction(async (tx) => {
    await tx.deal.update({ where: { id: deal.id }, data: { deletedAt: new Date() } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "Deal", entityId: deal.id, summary: `Deleted deal ${deal.title}` });
  });
  revalidatePath("/pipeline");
  redirect("/pipeline");
}

export async function deleteActivityAction(fd: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError();
  const a = await prisma.activity.findFirst({ where: { id: str(fd, "id"), deletedAt: null } });
  if (!a || a.type === "STAGE_CHANGE") return;
  // People can remove their own entries; managers above them, Head and Admin can too.
  if (a.userId !== user.id && !(await canEditDeal(user, { ownerId: a.userId }))) throw new ForbiddenError();
  await prisma.$transaction(async (tx) => {
    await tx.activity.update({ where: { id: a.id }, data: { deletedAt: new Date() } });
    if (a.dealId) {
      // Recalculate the last activity date without the deleted entry.
      const deal = await tx.deal.findUniqueOrThrow({ where: { id: a.dealId } });
      const last = await tx.activity.findFirst({ where: { dealId: a.dealId, deletedAt: null }, orderBy: { occurredAt: "desc" } });
      const candidates = [deal.createdAt, deal.stageChangedAt, last?.occurredAt].filter((d): d is Date => !!d);
      await tx.deal.update({ where: { id: a.dealId }, data: { lastActivityAt: new Date(Math.max(...candidates.map((d) => d.getTime()))) } });
    }
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "Activity", entityId: a.id, summary: `Deleted activity: ${a.subject}` });
  });
  if (a.dealId) revalidatePath(`/deals/${a.dealId}`);
  revalidatePath(`/clients/${a.clientId}`);
}
