-- Drop share shards when recipient already has a direct shard on the parent message.

DELETE FROM "message_key_manifest_shards" AS mkms
USING "shares" AS s
WHERE s."id" = mkms."message_id"
  AND EXISTS (
    SELECT 1
    FROM "message_key_manifest_shards" AS existing
    WHERE existing."message_id" = s."message_id"
      AND existing."recipient_key_id" = mkms."recipient_key_id"
  );
