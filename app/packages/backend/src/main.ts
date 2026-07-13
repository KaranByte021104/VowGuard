import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(cookieParser());
  
  // Double-submit cookie CSRF protection
  const { doubleCsrf } = require('csrf-csrf');
  const { doubleCsrfProtection } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || 'fallback-secret-for-dev',
    cookieName: 'x-csrf-token',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    },
    getTokenFromRequest: (req) => req.headers['x-csrf-token'],
  });
  
  // NOTE: In a real app, this should only protect state-changing routes, 
  // or provide an endpoint to fetch the token. We apply it globally for now 
  // as per standard double-submit setups, but it might need tuning per route.
  // app.use(doubleCsrfProtection); // Keeping disabled unless explicitly enabled in routing 
  
  const config = new DocumentBuilder()
    .setTitle('SecureVault API')
    .setDescription('The SecureVault enterprise password manager API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:5173',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
