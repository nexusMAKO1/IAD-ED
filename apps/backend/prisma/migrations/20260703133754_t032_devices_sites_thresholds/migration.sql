-- AlterEnum
ALTER TYPE "DeviceStatus" ADD VALUE 'DEGRADED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DeviceType" ADD VALUE 'WAITING_ROOM_SCREEN';
ALTER TYPE "DeviceType" ADD VALUE 'TICKET_KIOSK';

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Dispositif',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "anomalyQueueThreshold" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "densityThreshold" INTEGER NOT NULL DEFAULT 10;
