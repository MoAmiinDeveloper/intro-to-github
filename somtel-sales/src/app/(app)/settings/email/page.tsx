import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { smtpConfigured, smtpSummary } from "@/lib/email";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TestEmailForm } from "./test-form";
import { retryFailedEmailsAction } from "./actions";

export const metadata = { title: "Email" };

export default async function EmailSettingsPage() {
  const user = await requireUser();
  const s = smtpSummary();
  const configured = smtpConfigured();
  const [counts, recent] = await Promise.all([
    prisma.emailOutbox.groupBy({ by: ["status"], _count: true }),
    prisma.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const count = (st: string) => counts.find((c) => c.status === st)?._count ?? 0;
  return (
    <>
      <PageHeader title="Email" description="SMTP settings live in the .env file on the server so the password is never stored in the database." />
      <div className="space-y-5">
        <Card>
          <CardHeader title="SMTP" actions={configured ? <Badge tone="green">Set up</Badge> : <Badge tone="red">Not set up</Badge>} />
          <CardBody className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs uppercase text-gray-500">Host</dt><dd>{s.host || "Not set"}</dd></div>
              <div><dt className="text-xs uppercase text-gray-500">Port</dt><dd>{s.port}{s.secure ? " (TLS)" : " (STARTTLS)"}</dd></div>
              <div><dt className="text-xs uppercase text-gray-500">User</dt><dd>{s.user || "None"}</dd></div>
              <div className="sm:col-span-3"><dt className="text-xs uppercase text-gray-500">From</dt><dd>{s.from || "Not set"}</dd></div>
            </dl>
            {!configured && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Emails are saved in the queue but not sent until SMTP_HOST and the other SMTP values are set in .env and the app and worker are restarted.
              </p>
            )}
            <TestEmailForm defaultTo={user.email} disabled={!configured} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Email queue"
            description={`${count("PENDING")} waiting, ${count("SENT")} sent, ${count("FAILED")} failed. The worker sends queued emails every 30 seconds and retries failures.`}
            actions={
              count("FAILED") > 0 && (
                <form action={retryFailedEmailsAction}>
                  <Button variant="outline" size="sm">Retry failed</Button>
                </form>
              )
            }
          />
          {recent.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500">No emails yet.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>To</TH>
                  <TH>Subject</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {recent.map((m) => (
                  <TR key={m.id}>
                    <TD className="whitespace-nowrap text-xs">{formatDateTime(m.createdAt)}</TD>
                    <TD className="text-xs">{m.to}</TD>
                    <TD>{m.subject}</TD>
                    <TD>
                      <Badge tone={m.status === "SENT" ? "green" : m.status === "FAILED" ? "red" : "amber"}>{m.status === "SENT" ? "Sent" : m.status === "FAILED" ? "Failed" : "Waiting"}</Badge>
                      {m.lastError && m.status !== "SENT" && <div className="mt-1 max-w-xs truncate text-xs text-red-600" title={m.lastError}>{m.lastError}</div>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
