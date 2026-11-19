-- AlterTable
ALTER TABLE "User" ADD COLUMN     "draws" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "losses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "wins" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserGameStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "played" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGameStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserGameStat_gameType_wins_idx" ON "UserGameStat"("gameType", "wins");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameStat_userId_gameType_key" ON "UserGameStat"("userId", "gameType");

-- CreateIndex
CREATE INDEX "User_wins_idx" ON "User"("wins");

-- AddForeignKey
ALTER TABLE "UserGameStat" ADD CONSTRAINT "UserGameStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
