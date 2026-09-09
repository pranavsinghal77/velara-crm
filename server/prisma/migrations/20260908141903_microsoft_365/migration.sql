-- CreateEnum
CREATE TYPE "MicrosoftConnectionStatus" AS ENUM ('Connected', 'Expired', 'Revoked', 'Error');

-- CreateTable
CREATE TABLE "MicrosoftConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "microsoftUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MicrosoftConnectionStatus" NOT NULL DEFAULT 'Connected',
    "statusDetail" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicrosoftConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicrosoftOAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "redirectTo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MicrosoftOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MicrosoftConnection_userId_key" ON "MicrosoftConnection"("userId");

-- CreateIndex
CREATE INDEX "MicrosoftConnection_orgId_idx" ON "MicrosoftConnection"("orgId");

-- CreateIndex
CREATE INDEX "MicrosoftConnection_expiresAt_idx" ON "MicrosoftConnection"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MicrosoftOAuthState_state_key" ON "MicrosoftOAuthState"("state");

-- CreateIndex
CREATE INDEX "MicrosoftOAuthState_expiresAt_idx" ON "MicrosoftOAuthState"("expiresAt");

-- AddForeignKey
ALTER TABLE "MicrosoftConnection" ADD CONSTRAINT "MicrosoftConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicrosoftConnection" ADD CONSTRAINT "MicrosoftConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
