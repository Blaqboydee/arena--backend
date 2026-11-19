-- AlterTable
ALTER TABLE "MatchParticipant" ADD COLUMN     "ratingDelta" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 1000;

-- CreateIndex
CREATE INDEX "User_rating_idx" ON "User"("rating");
