import {
  Logger,
  ValidationPipe,
  type INestApplication,
  type Type,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

type BootstrapOptions = {
  /** Service-specific setup (middleware, message consumers) before the port opens. */
  beforeListen?: (app: INestApplication) => void | Promise<void>;
};

/**
 * Starts a service the same way everywhere. Public routes live under /api, the
 * only prefix the gateway forwards; /internal/* stays outside it so
 * service-to-service endpoints can't be reached from the browser.
 */
export async function bootstrapService(
  module: Type,
  name: string,
  options: BootstrapOptions = {},
): Promise<void> {
  const app = await NestFactory.create(module);

  app.setGlobalPrefix('api', { exclude: ['internal/{*path}'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle(`Waymark ${name} service`)
    .addBearerAuth()
    .build();
  SwaggerModule.setup(`api/${name}/docs`, app, () =>
    SwaggerModule.createDocument(app, config),
  );

  await options.beforeListen?.(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`${name} service listening on port ${port}`, 'Bootstrap');
}
