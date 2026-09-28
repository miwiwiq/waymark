import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { FollowStatus } from './follow-rules.js';

@Entity('follows')
export class Follow {
  @PrimaryColumn({ name: 'follower_id', type: 'uuid' })
  followerId: string;

  @PrimaryColumn({ name: 'followee_id', type: 'uuid' })
  followeeId: string;

  @Column({ type: 'text' })
  status: FollowStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** When the status last changed; lists are ordered by it, newest first. */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
