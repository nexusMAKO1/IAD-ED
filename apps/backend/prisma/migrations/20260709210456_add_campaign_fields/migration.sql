-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "activeHours" JSONB,
ADD COLUMN     "duration" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "mediaType" TEXT NOT NULL DEFAULT 'video',
ADD COLUMN     "playlistOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "targetAge" TEXT,
ADD COLUMN     "targetEmotion" TEXT,
ADD COLUMN     "targetGender" TEXT;
