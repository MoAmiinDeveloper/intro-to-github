-- Customers: Group -> Entity -> Person, services catalog renamed to Category -> Service -> Plan,
-- new IT catalog (vendors, shared categories, products, sub-products, distributors, cost history).
-- Existing data is kept: the ProductFamily table is renamed, not dropped.

-- CreateEnum
CREATE TYPE "ItKind" AS ENUM ('HARDWARE', 'SOFTWARE');

-- Retire IT resale items and tracking devices from the services catalog (they move to the IT catalog).
UPDATE "Plan" SET "deletedAt" = NOW(), "active" = false
  WHERE "deletedAt" IS NULL AND "serviceId" IN (
    SELECT "id" FROM "Service" WHERE "productType" = 'IT' OR ("productType" = 'TRACKING' AND "itemKind" = 'HARDWARE'));
UPDATE "Service" SET "deletedAt" = NOW(), "active" = false
  WHERE "deletedAt" IS NULL AND ("productType" = 'IT' OR ("productType" = 'TRACKING' AND "itemKind" = 'HARDWARE'));
UPDATE "ProductFamily" SET "deletedAt" = NOW(), "enabled" = false
  WHERE "deletedAt" IS NULL AND "name" = 'IT Resale';

-- Rename ProductFamily -> ServiceCategory
ALTER TABLE "ProductFamily" RENAME TO "ServiceCategory";
ALTER TABLE "ServiceCategory" RENAME CONSTRAINT "ProductFamily_pkey" TO "ServiceCategory_pkey";
ALTER INDEX "ProductFamily_name_key" RENAME TO "ServiceCategory_name_key";

-- Service.familyId -> Service.categoryId
ALTER TABLE "Service" DROP CONSTRAINT "Service_familyId_fkey";
ALTER TABLE "Service" RENAME COLUMN "familyId" TO "categoryId";
ALTER INDEX "Service_familyId_name_key" RENAME TO "Service_categoryId_name_key";
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" DROP COLUMN "itemKind", DROP COLUMN "vendor";
DROP TYPE "ItemKind";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "ClientGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sectorId" TEXT,
    "ownerId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClientGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactEntityLink" (
    "contactId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "ContactEntityLink_pkey" PRIMARY KEY ("contactId","clientId")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItProduct" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ItProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItSubProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "kind" "ItKind" NOT NULL,
    "quoteDescription" TEXT,
    "unitLabel" TEXT,
    "termMonths" INTEGER,
    "markupPct" DECIMAL(7,3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ItSubProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentTerms" TEXT,
    "remittanceNotes" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorContact" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorDistributor" (
    "vendorId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "partnerLevel" TEXT,
    "accountNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorDistributor_pkey" PRIMARY KEY ("vendorId","distributorId")
);

-- CreateTable
CREATE TABLE "DistributorPrice" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "subProductId" TEXT NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(14,6) NOT NULL,
    "quotedAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributorPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientGroup_name_idx" ON "ClientGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_name_key" ON "Vendor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ItCategory_name_key" ON "ItCategory"("name");

-- CreateIndex
CREATE INDEX "ItProduct_categoryId_idx" ON "ItProduct"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ItProduct_vendorId_name_key" ON "ItProduct"("vendorId", "name");

-- CreateIndex
CREATE INDEX "ItSubProduct_sku_idx" ON "ItSubProduct"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ItSubProduct_productId_name_key" ON "ItSubProduct"("productId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Distributor_name_key" ON "Distributor"("name");

-- CreateIndex
CREATE INDEX "DistributorPrice_subProductId_distributorId_quotedAt_idx" ON "DistributorPrice"("subProductId", "distributorId", "quotedAt");

-- CreateIndex
CREATE INDEX "Client_groupId_idx" ON "Client"("groupId");

-- AddForeignKey
ALTER TABLE "ClientGroup" ADD CONSTRAINT "ClientGroup_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGroup" ADD CONSTRAINT "ClientGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ClientGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactEntityLink" ADD CONSTRAINT "ContactEntityLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactEntityLink" ADD CONSTRAINT "ContactEntityLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItProduct" ADD CONSTRAINT "ItProduct_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItProduct" ADD CONSTRAINT "ItProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItSubProduct" ADD CONSTRAINT "ItSubProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ItProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorContact" ADD CONSTRAINT "DistributorContact_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDistributor" ADD CONSTRAINT "VendorDistributor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDistributor" ADD CONSTRAINT "VendorDistributor_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorPrice" ADD CONSTRAINT "DistributorPrice_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorPrice" ADD CONSTRAINT "DistributorPrice_subProductId_fkey" FOREIGN KEY ("subProductId") REFERENCES "ItSubProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

