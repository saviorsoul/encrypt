ALTER TABLE "messages" ADD COLUMN "last_comment_at" TIMESTAMP(3);

UPDATE "messages" AS m
SET "last_comment_at" = (
  SELECT MAX(c."created_at")
  FROM "comments" AS c
  WHERE c."message_id" = m."id"
);
