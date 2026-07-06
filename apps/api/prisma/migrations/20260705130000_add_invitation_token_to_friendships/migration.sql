-- AlterTable
ALTER TABLE "friendship_requests" ADD COLUMN "invitation_token" TEXT;

-- AlterTable
ALTER TABLE "user_friendships" ADD COLUMN "invitation_token" TEXT;
