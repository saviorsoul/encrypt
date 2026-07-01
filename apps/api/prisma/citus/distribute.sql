-- Run on the Citus coordinator after Prisma migrations.
-- Idempotent: skips tables that are already reference/distributed.

DO $$
DECLARE
  table_name text;
  ref_tables text[] := ARRAY['users', 'messages', 'shares', 'comments'];
  dist_table text := 'message_key_manifest_shards';
BEGIN
  FOREACH table_name IN ARRAY ref_tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_dist_partition
      WHERE logicalrelid = table_name::regclass
    ) THEN
      EXECUTE format('SELECT create_reference_table(%L)', table_name);
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_dist_partition
    WHERE logicalrelid = dist_table::regclass
  ) THEN
    PERFORM create_distributed_table(dist_table, 'recipient_key_id');
  END IF;
END $$;
