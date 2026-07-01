-- CreateTable
CREATE TABLE "users" (
    "keyId" TEXT NOT NULL,
    "publicKey" JSONB NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("keyId")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "payload" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shares" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "payload" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "payload" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_key_manifest_shards" (
    "message_id" UUID NOT NULL,
    "recipient_key_id" TEXT NOT NULL,
    "entry_json" TEXT NOT NULL,

    CONSTRAINT "message_key_manifest_shards_pkey" PRIMARY KEY ("message_id","recipient_key_id")
);

-- CreateIndex
CREATE INDEX "shares_message_id_idx" ON "shares"("message_id");

-- CreateIndex
CREATE INDEX "comments_message_id_idx" ON "comments"("message_id");

-- CreateIndex
CREATE INDEX "message_key_manifest_shards_recipient_key_id_idx" ON "message_key_manifest_shards"("recipient_key_id");

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_key_manifest_shards" ADD CONSTRAINT "message_key_manifest_shards_recipient_key_id_fkey" FOREIGN KEY ("recipient_key_id") REFERENCES "users"("keyId") ON DELETE RESTRICT ON UPDATE CASCADE;
