import { healthController, requireEnv, usersEventsPublisher } from '@app/common';
import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './account.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService, USERS_EVENTS } from './auth.service.js';
import { GoogleAuthController } from './google.controller.js';
import { googleEnabled, GoogleStrategy } from './google.strategy.js';
import { LocalStrategy } from './local.strategy.js';
import { CreateAccounts1790208000000 } from './migrations/1790208000000-create-accounts.js';
import { TokenService } from './token.service.js';

const google = googleEnabled();

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: requireEnv('DATABASE_URL'),
        entities: [Account],
        migrations: [CreateAccounts1790208000000],
        migrationsRun: true,
      }),
    }),
    TypeOrmModule.forFeature([Account]),
    PassportModule,
    ClientsModule.registerAsync([
      {
        name: USERS_EVENTS,
        useFactory: () => usersEventsPublisher(requireEnv('RABBITMQ_URL')),
      },
    ]),
  ],
  controllers: [
    healthController('auth'),
    AuthController,
    ...(google ? [GoogleAuthController] : []),
  ],
  providers: [
    AuthService,
    TokenService,
    LocalStrategy,
    ...(google ? [GoogleStrategy] : []),
  ],
})
export class AuthModule {}
