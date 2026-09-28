import { bootstrapService, requireEnv, usersEventsConsumer } from '@app/common';
import { UsersModule } from './users.module.js';

await bootstrapService(UsersModule, 'users', {
  beforeListen: async (app) => {
    app.connectMicroservice(usersEventsConsumer(requireEnv('RABBITMQ_URL')));
    await app.startAllMicroservices();
  },
});
