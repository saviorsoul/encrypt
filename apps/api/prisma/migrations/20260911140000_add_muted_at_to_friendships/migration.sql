-- AlterTable
ALTER TABLE "user_friendships" ADD COLUMN "messages_muted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_friendships" ADD COLUMN "shares_muted" BOOLEAN NOT NULL DEFAULT false;
