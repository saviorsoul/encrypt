-- Remap remaining share-backed rows (message_id was share delivery id).

UPDATE "message_key_manifest_shards" AS mkms
SET
  "share_id" = mkms."message_id",
  "message_id" = s."message_id"
FROM "shares" AS s
WHERE s."id" = mkms."message_id"
  AND mkms."share_id" IS NULL;
