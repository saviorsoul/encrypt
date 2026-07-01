-- Multiple share deliveries for the same parent + recipient: keep one share shard.

DELETE FROM "message_key_manifest_shards" AS mkms
USING "shares" AS s
WHERE s."id" = mkms."message_id"
  AND EXISTS (
    SELECT 1
    FROM "message_key_manifest_shards" AS other
    INNER JOIN "shares" AS s2 ON s2."id" = other."message_id"
    WHERE s2."message_id" = s."message_id"
      AND other."recipient_key_id" = mkms."recipient_key_id"
      AND other."message_id"::text < mkms."message_id"::text
  );
