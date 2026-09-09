-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('instagram', 'facebook', 'linkedin', 'x', 'whatsapp');

-- CreateEnum
CREATE TYPE "SocialConnectionStatus" AS ENUM ('Connected', 'Expired', 'Revoked', 'Error');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('Draft', 'Scheduled', 'Publishing', 'Published', 'PartiallyPublished', 'Failed', 'Canceled');

-- CreateTable
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SocialConnectionStatus" NOT NULL DEFAULT 'Connected',
    "statusDetail" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "lastPublishAt" TIMESTAMP(3),
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialOAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "codeVerifier" TEXT,
    "redirectTo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaMime" TEXT,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'Draft',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPostTarget" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'Scheduled',
    "externalPostId" TEXT,
    "permalink" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "SocialPostTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialConnection_orgId_platform_idx" ON "SocialConnection"("orgId", "platform");

-- CreateIndex
CREATE INDEX "SocialConnection_orgId_status_idx" ON "SocialConnection"("orgId", "status");

-- CreateIndex
CREATE INDEX "SocialConnection_expiresAt_idx" ON "SocialConnection"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialConnection_orgId_platform_externalId_key" ON "SocialConnection"("orgId", "platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialOAuthState_state_key" ON "SocialOAuthState"("state");

-- CreateIndex
CREATE INDEX "SocialOAuthState_expiresAt_idx" ON "SocialOAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "SocialPost_orgId_status_scheduledAt_idx" ON "SocialPost"("orgId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "SocialPost_orgId_createdAt_idx" ON "SocialPost"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialPostTarget_status_idx" ON "SocialPostTarget"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPostTarget_postId_connectionId_key" ON "SocialPostTarget"("postId", "connectionId");

-- AddForeignKey
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPostTarget" ADD CONSTRAINT "SocialPostTarget_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPostTarget" ADD CONSTRAINT "SocialPostTarget_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

