import { healthController, requireEnv } from '@app/common';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follow } from './follow.entity.js';
import { FollowsController } from './follows.controller.js';
import { FollowsService } from './follows.service.js';
import { InternalUsersController } from './internal.controller.js';
import { CreateProfiles1790208000000 } from './migrations/1790208000000-create-profiles.js';
import { CreateFollows1790294400000 } from './migrations/1790294400000-create-follows.js';
import { Profile } from './profile.entity.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';
import { UserCreatedConsumer } from './user-created.consumer.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: requireEnv('DATABASE_URL'),
        entities: [Profile, Follow],
        migrations: [CreateProfiles1790208000000, CreateFollows1790294400000],
        migrationsRun: true,
      }),
    }),
    TypeOrmModule.forFeature([Profile, Follow]),
  ],
  // ProfilesController first: its by-username/:username route must win over
  // FollowsController's :id/... routes.
  controllers: [
    healthController('users'),
    ProfilesController,
    FollowsController,
    InternalUsersController,
    UserCreatedConsumer,
  ],
  providers: [ProfilesService, FollowsService],
})
export class UsersModule {}
