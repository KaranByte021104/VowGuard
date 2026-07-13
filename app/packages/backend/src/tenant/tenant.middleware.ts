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
        const decoded = jwt.decode(token) as any;
        if (decoded?.organizationId) {
          organizationId = decoded.organizationId;
        }
      } catch (e) {
        // ignore
      }
    }

    if (organizationId) {
      tenantContext.run({ organizationId }, () => next());
    } else {
      tenantContext.run({ organizationId: '' }, () => next());
    }
  }
}
