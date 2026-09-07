-- CreateIndex
CREATE INDEX "messages_sender_key_id_created_at_idx" ON "messages"("sender_key_id", "created_at");
