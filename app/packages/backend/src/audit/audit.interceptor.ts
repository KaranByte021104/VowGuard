import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService, private alertsService: AlertsService) {}

  async logEvent(action: string, req: any, data: any, error?: any) {
    const { method, url, user, ip } = req;
    try {
      let organizationId = user?.organizationId;
      let userId = user?.id;
      let resourceId = null;

      const parts = url.split('/');
      if (parts.length > 2 && parts[parts.length - 1].length > 10) {
         resourceId = parts[parts.length - 1]; 
      }

      if (!organizationId && data && data.user) {
         organizationId = data.user.organizationId;
         userId = data.user.id;
      } else if (!organizationId && req.body?.organizationId) {
         organizationId = req.body.organizationId;
      }
      
      // Fallback for failed logins where user might not be in req or data
      if (!organizationId && error && method === 'POST' && url.includes('/auth/login')) {
         // Try to find the user by email to get their orgId
         const email = req.body?.email;
         if (email) {
           const attemptUser = await this.prisma.user.findUnique({ where: { email } });
           if (attemptUser) {
             organizationId = attemptUser.organizationId;
             userId = attemptUser.id;
           }
         }
      }

      if (organizationId) {
        const logEntry = await this.prisma.auditLog.create({
          data: {
            action,
            userId,
            organizationId,
            ipAddress: ip,
            details: JSON.stringify({ body: req.body, query: req.query, error: error?.message }),
            resourceId
          }
        });
        
        await this.alertsService.processAuditLog(logEntry);
      }
    } catch (e) {
      console.error('Failed to write audit log:', e);
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;

    return next.handle().pipe(
      tap(async (data) => {
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
          let action = `${method} ${url.split('?')[0]}`;
          
          if (method === 'DELETE' && url.includes('/secrets/')) action = 'SECRET_DELETED';
          if (method === 'POST' && url.includes('/shares/third-party')) action = 'THIRD_PARTY_INVITE_CREATED';
          if (method === 'POST' && url.includes('/auth/login')) action = 'LOGIN_SUCCESS';

          await this.logEvent(action, req, data);
        }
      }),
      catchError((error) => {
        if (method === 'POST' && url.includes('/auth/login')) {
           this.logEvent('LOGIN_FAILED', req, null, error);
        } else if (method === 'POST' && url.includes('/backup/')) {
           this.logEvent('BACKUP_FAILED', req, null, error);
        }
        return throwError(() => error);
      })
    );
  }
}
