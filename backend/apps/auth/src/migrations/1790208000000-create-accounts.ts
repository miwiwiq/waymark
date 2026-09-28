import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccounts1790208000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE accounts (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email         text NOT NULL CONSTRAINT accounts_email_key UNIQUE,
        password_hash text,
        google_id     text CONSTRAINT accounts_google_id_key UNIQUE,
        created_at    timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE accounts');
  }
}
