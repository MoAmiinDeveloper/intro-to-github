import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyForm } from "./company-form";

export const metadata = { title: "Company and logo" };

export default async function CompanyPage() {
  const p = await prisma.companyProfile.findUnique({ where: { id: "company" } });
  return (
    <>
      <PageHeader title="Company and logo" />
      <CompanyForm values={{ ...(p ?? { name: "Somtel Enterprise" }), hasCustomLogo: !!p?.logoPath }} />
    </>
  );
}
