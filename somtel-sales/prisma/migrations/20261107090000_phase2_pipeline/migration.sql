-- Phase 2: deals, deal products, activities, stage history, reminder log.
-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'MEETING', 'EMAIL', 'NOTE', 'STAGE_CHANGE');

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL,
    "stageId" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "oneTimeValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthlyValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expectedCloseDate" DATE,
    "ownerId" TEXT NOT NULL,
    "nextStep" TEXT,
    "nextFollowUpAt" DATE,
    "lostReasonId" TEXT,
    "lostNote" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealProduct" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "planId" TEXT,
    "subProductId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL DEFAULT 1,
    "oneTimeValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthlyValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DealProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "clientId" TEXT NOT NULL,
    "dealId" TEXT,
    "userId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealStageChange" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealStageChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_ownerId_idx" ON "Deal"("ownerId");

-- CreateIndex
CREATE INDEX "Deal_stageId_idx" ON "Deal"("stageId");

-- CreateIndex
CREATE INDEX "Deal_clientId_idx" ON "Deal"("clientId");

-- CreateIndex
CREATE INDEX "Deal_nextFollowUpAt_idx" ON "Deal"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "Activity_clientId_occurredAt_idx" ON "Activity"("clientId", "occurredAt");

-- CreateIndex
CREATE INDEX "Activity_dealId_occurredAt_idx" ON "Activity"("dealId", "occurredAt");

-- CreateIndex
CREATE INDEX "DealStageChange_dealId_idx" ON "DealStageChange"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_kind_dealId_key_key" ON "ReminderLog"("kind", "dealId", "key");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_lostReasonId_fkey" FOREIGN KEY ("lostReasonId") REFERENCES "LostReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealProduct" ADD CONSTRAINT "DealProduct_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealProduct" ADD CONSTRAINT "DealProduct_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealProduct" ADD CONSTRAINT "DealProduct_subProductId_fkey" FOREIGN KEY ("subProductId") REFERENCES "ItSubProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStageChange" ADD CONSTRAINT "DealStageChange_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

