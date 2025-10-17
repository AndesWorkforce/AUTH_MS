import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Main');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.NATS,
      options: {
        servers: [
          `nats://${process.env.NATS_HOST}:${process.env.NATS_PORT}` ||
            'nats://localhost:4222',
        ],
        user: process.env.NATS_USERNAME,
        pass: process.env.NATS_PASSWORD,
      },
    },
  );

  await app.listen();

  logger.log(`Auth microservice is running on NATS`);
}
bootstrap();
