import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Flat comments (F1). */
@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id', type: 'text' })
  postId: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  /** Copied from User Service when the comment is created (I2). */
  @Column({ name: 'author_username', type: 'text' })
  authorUsername: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
