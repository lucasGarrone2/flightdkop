import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function getSanitizedDbUrl(): string {
  let dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    return 'file:./dev.db';
  }
  // Strip surrounding quotes if user typed "file:./dev.db" in Render UI
  dbUrl = dbUrl.replace(/^["']|["']$/g, '');
  if (!dbUrl.startsWith('file:')) {
    dbUrl = `file:${dbUrl}`;
  }
  return dbUrl;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url: getSanitizedDbUrl(),
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}


