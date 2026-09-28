import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('profiles')
export class Profile {
  /** Same id as the Auth account. */
  @PrimaryColumn('uuid')
  id: string;

  /** NULL until chosen (decision I7); the unique index allows many NULLs. Never changes once set (I2). */
  @Column({ type: 'text', nullable: true, unique: true })
  username: string | null;

  /** YYYY-MM-DD; NULL until a Google user completes onboarding. */
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  displayName: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ name: 'is_private', type: 'boolean', default: false })
  isPrivate: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
