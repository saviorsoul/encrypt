-- CreateTable
CREATE TABLE "friendship_requests" (
    "requester_key_id" TEXT NOT NULL,
    "target_key_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendship_requests_pkey" PRIMARY KEY ("requester_key_id","target_key_id")
);

-- CreateTable
CREATE TABLE "user_friendships" (
    "owner_key_id" TEXT NOT NULL,
    "friend_key_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_friendships_pkey" PRIMARY KEY ("owner_key_id","friend_key_id")
);

-- CreateIndex
CREATE INDEX "friendship_requests_target_key_id_status_idx" ON "friendship_requests"("target_key_id", "status");
