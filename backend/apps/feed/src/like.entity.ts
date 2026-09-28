import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** One row per user and post; the primary key makes liking idempotent (F1). */
@Entity('likes')
export class Like {
  /** The post's MongoDB id, owned by Post Service. */
  @PrimaryColumn({ name: 'post_id', type: 'text' })
  postId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
