-- Legacy friendship requests predate invitation tokens and cannot be accepted.
DELETE FROM "friendship_requests" WHERE "invitation_token" IS NULL;
