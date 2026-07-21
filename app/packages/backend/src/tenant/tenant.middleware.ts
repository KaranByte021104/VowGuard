import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext } from './tenant.context';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let organizationId: string | undefined;

    const token = req.cookies?.['access_token'] || req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const secret = process.env.JWT_SECRET || 'a4d2e8b9f1c3a6b5d7e4f2c8a9b1c3d5e7f9a2b4c6d8e0f1a3b5c7d9e2f4a6c8';
        const decoded = jwt.verify(token, secret) as any;
        if (decoded?.organizationId) {
          organizationId = decoded.organizationId;
        }
      } catch (e) {
        // Token invalid or expired — context will be empty string, Passport will reject the request
      }
    }

    if (organizationId) {
      tenantContext.run({ organizationId }, () => next());
    } else {
      tenantContext.run({ organizationId: '' }, () => next());
    }
  }
}
