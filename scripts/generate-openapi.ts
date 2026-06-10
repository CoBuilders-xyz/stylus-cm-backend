import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Stylus Cache Manager API')
    .setDescription('REST API for the Stylus Cache Manager backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outDir = path.resolve(__dirname, '../../mkdocs/docs/en/api');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'openapi.json');
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI spec written to ${outPath}`);

  await app.close();
  process.exit(0);
}

generate().catch((err) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
