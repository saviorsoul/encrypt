-- CreateTable
CREATE TABLE "friend_invitations" (
    "token" TEXT NOT NULL,
    "inviter_key_id" TEXT NOT NULL,
    "inviter_label" TEXT,
    "status" TEXT NOT NULL,
    "invitee_key_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "friend_invitations_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "friend_invitations_inviter_key_id_status_idx" ON "friend_invitations"("inviter_key_id", "status");
