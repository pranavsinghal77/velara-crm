-- CreateTable
CREATE TABLE "SocialPostMetric" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "impressions" INTEGER,
    "reach" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "clicks" INTEGER,
    "videoViews" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "unavailable" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fetchError" TEXT,

    CONSTRAINT "SocialPostMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccountMetric" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "followers" INTEGER,
    "postCount" INTEGER,
    "impressions28d" INTEGER,
    "unavailable" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fetchError" TEXT,

    CONSTRAINT "SocialAccountMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialPostMetric_targetId_key" ON "SocialPostMetric"("targetId");

-- CreateIndex
CREATE INDEX "SocialPostMetric_orgId_fetchedAt_idx" ON "SocialPostMetric"("orgId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccountMetric_connectionId_key" ON "SocialAccountMetric"("connectionId");

-- CreateIndex
CREATE INDEX "SocialAccountMetric_orgId_fetchedAt_idx" ON "SocialAccountMetric"("orgId", "fetchedAt");

-- AddForeignKey
ALTER TABLE "SocialPostMetric" ADD CONSTRAINT "SocialPostMetric_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "SocialPostTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPostMetric" ADD CONSTRAINT "SocialPostMetric_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccountMetric" ADD CONSTRAINT "SocialAccountMetric_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccountMetric" ADD CONSTRAINT "SocialAccountMetric_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
