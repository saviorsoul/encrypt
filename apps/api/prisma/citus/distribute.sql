-- Run on the Citus coordinator after Prisma migrations.
-- Idempotent: skips tables that are already reference/distributed.

DO $$
DECLARE
  table_name text;
  ref_tables text[] := ARRAY[
    'users',
    'messages',
    'shares',
    'comments',
    'friendship_requests'
  ];
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
    WHERE logicalrelid = 'message_key_manifest_shards'::regclass
  ) THEN
    PERFORM create_distributed_table('message_key_manifest_shards', 'recipient_key_id');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_dist_partition
    WHERE logicalrelid = 'user_friendships'::regclass
  ) THEN
    PERFORM create_distributed_table(
      'user_friendships',
      'owner_key_id',
      colocate_with => 'message_key_manifest_shards'
    );
  END IF;
END $$;
