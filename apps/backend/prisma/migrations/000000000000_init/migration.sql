-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('TOTEM', 'SCREEN', 'KIOSK', 'CAMERA');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'AGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MLModelType" AS ENUM ('IAD', 'SMARTQUEUE');

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "type" "DeviceType" NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "siteId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "targetAudience" JSONB NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'standard',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_events" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "peopleCount" INTEGER NOT NULL,
    "densityScore" DOUBLE PRECISION NOT NULL,
    "avgDwellTime" DOUBLE PRECISION NOT NULL,
    "youngCount" INTEGER NOT NULL,
    "adultCount" INTEGER NOT NULL,
    "seniorCount" INTEGER NOT NULL,

    CONSTRAINT "audience_events_pkey" PRIMARY KEY ("id", "timestamp")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "estimatedWaitMinutes" INTEGER NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_models" (
    "id" UUID NOT NULL,
    "type" "MLModelType" NOT NULL,
    "version" TEXT NOT NULL,
    "mae" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "devices_siteId_idx" ON "devices"("siteId");

-- CreateIndex
CREATE INDEX "users_siteId_idx" ON "users"("siteId");

-- CreateIndex
CREATE INDEX "audience_events_siteId_idx" ON "audience_events"("siteId");

-- CreateIndex
CREATE INDEX "audience_events_deviceId_idx" ON "audience_events"("deviceId");

-- CreateIndex
CREATE INDEX "audience_events_timestamp_idx" ON "audience_events"("timestamp");

-- CreateIndex
CREATE INDEX "tickets_siteId_idx" ON "tickets"("siteId");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_createdAt_idx" ON "tickets"("createdAt");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_events" ADD CONSTRAINT "audience_events_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_events" ADD CONSTRAINT "audience_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('audience_events', 'timestamp');
