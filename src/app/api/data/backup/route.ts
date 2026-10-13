import { exportDatabaseJson, restoreDatabaseJson } from '@/lib/data-transfer.server';
import { createDataTransferHandlers } from '@/lib/data-transfer-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = createDataTransferHandlers({
  exportBackup: exportDatabaseJson,
  restoreBackup: restoreDatabaseJson,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
