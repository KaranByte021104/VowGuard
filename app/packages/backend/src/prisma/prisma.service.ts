import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantContext } from '../tenant/tenant.context';

const ISOLATED_MODELS = ['Secret', 'Folder', 'User', 'UserGroup', 'AuditLog', 'FolderSecret'];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private _extendedClient: any;

  constructor() {
    super();
    
    this._extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const context = tenantContext.getStore();
            if (context?.organizationId && model && ISOLATED_MODELS.includes(model)) {
              if (['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count'].includes(operation)) {
                args = args || {} as any;
                (args as any).where = (args as any).where || {};
                
                // Convert findUnique to findFirst to avoid unique constraint errors with organizationId
                if (operation === 'findUnique') {
                  operation = 'findFirst';
                }
                
                (args as any).where.organizationId = context.organizationId;
              }
              
              if (['create', 'createMany'].includes(operation)) {
                args = args || {} as any;
                (args as any).data = (args as any).data || {};
                
                if (Array.isArray((args as any).data)) {
                  (args as any).data = (args as any).data.map((d: any) => ({ ...d, organizationId: context.organizationId }));
                } else {
                  (args as any).data.organizationId = context.organizationId;
                }
              }
            }
            return query(args);
          }
        }
      }
    });

    return new Proxy(this, {
      get: (target, prop) => {
        if (typeof prop === 'string' && ISOLATED_MODELS.includes(prop)) {
          return target._extendedClient[prop];
        }
        return Reflect.get(target, prop);
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
