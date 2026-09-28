import { healthController, requireEnv, UsersClient } from '@app/common';
import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { Comment } from './comment.entity.js';
import { FeedController } from './feed.controller.js';
import { FeedService } from './feed.service.js';
import { InteractionsController } from './interactions.controller.js';
import { InteractionsService } from './interactions.service.js';
import { Like } from './like.entity.js';
import { CreateInteractions1790380800000 } from './migrations/1790380800000-create-interactions.js';
import { PostsClient } from './posts.client.js';
import { StatsService } from './stats.service.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: requireEnv('DATABASE_URL'),
        entities: [Like, Comment],
        migrations: [CreateInteractions1790380800000],
        migrationsRun: true,
      }),
    }),
    TypeOrmModule.forFeature([Comment]),
  ],
  controllers: [healthController('feed'), FeedController, InteractionsController],
  providers: [
    FeedService,
    InteractionsService,
    StatsService,
    PostsClient,
    UsersClient,
    // The cache (decision A2); Redis only, nothing here is the source of truth.
    // While Redis is down, commands fail at once instead of queueing, so reads
    // fall back to Postgres and Post Service without waiting (F4).
    {
      provide: Redis,
      useFactory: () =>
        new Redis(requireEnv('REDIS_URL'), { enableOfflineQueue: false, maxRetriesPerRequest: 1 }),
    },
  ],
})
export class FeedModule implements OnApplicationShutdown {
  constructor(private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
