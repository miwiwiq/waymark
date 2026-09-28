import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import type { MediaKind } from './media-rules.js';

@Schema({ _id: false })
export class PostLocation {
  @Prop({ type: String, required: true })
  country: string;

  @Prop({ type: String, required: true })
  city: string;

  @Prop({ type: Number })
  lat?: number;

  @Prop({ type: Number })
  lng?: number;
}

@Schema({ _id: false })
export class Media {
  /** Object key in the private bucket; URLs are signed per response (P3). */
  @Prop({ type: String, required: true })
  key: string;

  @Prop({ type: String, required: true, enum: ['image', 'video'] })
  type: MediaKind;

  /** Average colour and pixel size, sent by the browser for placeholders (P2). */
  @Prop({ type: String })
  color?: string;

  @Prop({ type: Number })
  width?: number;

  @Prop({ type: Number })
  height?: number;
}

@Schema({ collection: 'posts', timestamps: true })
export class Post {
  @Prop({ type: String, required: true })
  authorId: string;

  /** Copied from User Service at creation; usernames never change (I2). */
  @Prop({ type: String, required: true })
  authorUsername: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, default: '' })
  caption: string;

  @Prop({ type: SchemaFactory.createForClass(PostLocation), required: true })
  location: PostLocation;

  /** YYYY-MM-DD */
  @Prop({ type: String, required: true })
  tripStart: string;

  /** YYYY-MM-DD, not before tripStart. */
  @Prop({ type: String, required: true })
  tripEnd: string;

  /** 1–10 files, in display order. */
  @Prop({ type: [SchemaFactory.createForClass(Media)], required: true })
  media: Media[];

  @Prop({ type: Boolean, default: false })
  isArchived: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type PostDocument = HydratedDocument<Post>;

export const PostSchema = SchemaFactory.createForClass(Post);

// Profile grids and the feed: live posts of one or more authors, newest first.
PostSchema.index({ authorId: 1, isArchived: 1, createdAt: -1, _id: -1 });
