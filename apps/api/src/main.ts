import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation with transformation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable graceful shutdown for cron jobs
  app.enableShutdownHooks();

  // Enable CORS for frontend
  const corsOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://fortune.syntratrade.com',
  ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🎰 Fortune City API running on http://localhost:${port}`);
}
void bootstrap();
