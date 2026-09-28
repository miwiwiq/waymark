import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInteractions1790380800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // post_id is a MongoDB id from Post Service, so there's no foreign key.
    await queryRunner.query(`
      CREATE TABLE likes (
        post_id    text NOT NULL,
        user_id    uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (post_id, user_id)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE comments (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id         text NOT NULL,
        author_id       uuid NOT NULL,
        author_username text NOT NULL,
        body            text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
        created_at      timestamptz NOT NULL DEFAULT now()
      )
    `);
    // A post's comments, newest first, and their count.
    await queryRunner.query(
      'CREATE INDEX comments_post_created_idx ON comments (post_id, created_at, id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE comments');
    await queryRunner.query('DROP TABLE likes');
  }
}
