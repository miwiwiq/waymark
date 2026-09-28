import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProfiles1790208000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE profiles (
        id            uuid PRIMARY KEY,
        username      text CONSTRAINT profiles_username_key UNIQUE,
        date_of_birth date,
        display_name  text,
        bio           text,
        is_private    boolean NOT NULL DEFAULT false,
        created_at    timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE profiles');
  }
}
