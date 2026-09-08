-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "sourceRef" TEXT;

-- CreateTable
CREATE TABLE "ApolloConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultOwnerId" TEXT,
    "lastImportAt" TIMESTAMP(3),
    "importedTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApolloConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApolloConfig_orgId_key" ON "ApolloConfig"("orgId");

-- CreateIndex
CREATE INDEX "Lead_orgId_source_sourceRef_idx" ON "Lead"("orgId", "source", "sourceRef");

-- AddForeignKey
ALTER TABLE "ApolloConfig" ADD CONSTRAINT "ApolloConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
