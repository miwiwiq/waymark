import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFollows1790294400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE follows (
        follower_id uuid NOT NULL REFERENCES profiles (id),
        followee_id uuid NOT NULL REFERENCES profiles (id),
        status      text NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (follower_id, followee_id),
        CHECK (follower_id <> followee_id)
      )
    `);
    // Followers lists, counts and incoming requests all filter by followee and status.
    await queryRunner.query(
      'CREATE INDEX follows_followee_status_idx ON follows (followee_id, status)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE follows');
  }
}
