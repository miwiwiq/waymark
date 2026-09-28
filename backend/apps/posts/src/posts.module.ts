import { healthController, requireEnv, UsersClient } from '@app/common';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InternalPostsController } from './internal.controller.js';
import { Post, PostSchema } from './post.schema.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';
import { StorageService } from './storage.service.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({ uri: requireEnv('MONGO_URL') }),
    }),
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
  ],
  controllers: [healthController('posts'), PostsController, InternalPostsController],
  providers: [PostsService, StorageService, UsersClient],
})
export class PostsModule {}
