import { getDropboxClient } from '@/lib/dropbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ID_RE = /^[a-zA-Z0-9-]{20,64}$/;
const RETENTION_HOURS = Number(process.env.PENDING_RETENTION_HOURS || 24);

async function listAll(dbx, path) {
  let res = await dbx.filesListFolder({ path });
  const entries = [...res.result.entries];
  while (res.result.has_more) {
    res = await dbx.filesListFolderContinue({ cursor: res.result.cursor });
    entries.push(...res.result.entries);
  }
  return entries;
}

export async function GET(request) {
  // Only allow calls that carry the secret (Vercel Cron sends it automatically)
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
  const cutoff = Date.now() - RETENTION_HOURS * 60 * 60 * 1000;
  const dbx = getDropboxClient();

  let folders;
  try {
    const entries = await listAll(dbx, '/Pending');
    // Only touch folders whose name looks like an upload ID
    folders = entries.filter((e) => e['.tag'] === 'folder' && ID_RE.test(e.name));
  } catch (err) {
    const summary = err?.error?.error_summary || '';
    if (summary.startsWith('path/not_found')) {
      return Response.json({ dryRun, checked: 0, deleted: [], kept: 0 });
    }
    console.error('cleanup-pending list error', err);
    return Response.json({ error: 'Could not list /Pending' }, { status: 500 });
  }

  const deleted = [];
  let kept = 0;
  const errors = [];

  for (const folder of folders) {
    const path = `/Pending/${folder.name}`;
    try {
      const files = (await listAll(dbx, path)).filter((e) => e['.tag'] === 'file');

      // Age = newest file in the folder (folders have no date of their own)
      const newest = files.reduce(
        (max, f) => Math.max(max, new Date(f.server_modified).getTime()),
        0
      );

      // Empty folders (no files) are leftovers and can go; otherwise wait for the cutoff
      const isOld = files.length === 0 || newest < cutoff;

      if (!isOld) {
        kept++;
        continue;
      }

      if (!dryRun) {
        await dbx.filesDeleteV2({ path });
      }
      deleted.push({
        id: folder.name,
        files: files.length,
        newest: newest ? new Date(newest).toISOString() : null,
      });
    } catch (err) {
      console.error('cleanup-pending error for', folder.name, err);
      errors.push(folder.name);
    }
  }

  return Response.json({
    dryRun,
    retentionHours: RETENTION_HOURS,
    checked: folders.length,
    deleted,
    kept,
    errors,
  });
}