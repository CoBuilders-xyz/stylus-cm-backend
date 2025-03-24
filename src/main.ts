import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: ['http://localhost:5000'], // TODO Make it env variable
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    },
    logger: ['error', 'debug', 'warn', 'log'],
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
