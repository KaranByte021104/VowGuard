import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:5173',
    credentials: true,
  });
  
  // Double-submit cookie CSRF protection
  const { doubleCsrf } = require('csrf-csrf');
  const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || 'fallback-secret-for-dev',
    cookieName: 'x-csrf-token',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    },
    getTokenFromRequest: (req) => req.headers['x-csrf-token'],
    getSessionIdentifier: (req) => req.cookies?.['access_token'] || 'anonymous',
  });

  // Expose GET /csrf-token so the SPA can pick up a fresh CSRF token
  // before making its first state-changing request.
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'GET' && req.path === '/csrf-token') {
      return res.json({ csrfToken: generateCsrfToken(req, res) });
    }
    return next();
  });
  
  // Double-submit cookie CSRF protection — applied only to state-changing methods.
  // GET/HEAD/OPTIONS are skipped so the SPA can make read requests freely.
  app.use((req: any, res: any, next: any) => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) return next();
    return doubleCsrfProtection(req, res, (err: any) => {
      if (err && err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ statusCode: 403, message: 'invalid csrf token' });
      }
      return next(err);
    });
  });
  
  const config = new DocumentBuilder()
    .setTitle('SecureVault API')
    .setDescription('The SecureVault enterprise password manager API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  


  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
