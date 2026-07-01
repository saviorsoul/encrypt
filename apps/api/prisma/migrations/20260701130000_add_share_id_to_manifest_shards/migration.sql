-- Add share_id so message_id always refers to the thread root message.

ALTER TABLE "message_key_manifest_shards" ADD COLUMN IF NOT EXISTS "share_id" UUID;
