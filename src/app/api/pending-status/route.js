import { getDropboxClient } from '@/lib/dropbox';

export const dynamic = 'force-dynamic';

const ID_RE = /^[a-zA-Z0-9-]{20,64}$/;

export async function GET(request) {
  const uploadId = new URL(request.url).searchParams.get('uploadId') || '';

  // Bad or empty ID: answer false (200) so Make doesn't treat it as an error
  if (!ID_RE.test(uploadId)) {
    return Response.json({ hasFiles: false, fileCount: 0 });
  }

  const dbx = getDropboxClient();

  try {
    const res = await dbx.filesListFolder({ path: `/Pending/${uploadId}` });
    const fileCount = res.result.entries.filter((e) => e['.tag'] === 'file').length;
    return Response.json({ hasFiles: fileCount > 0, fileCount });
  } catch (err) {
    const summary = err?.error?.error_summary || '';
    if (summary.startsWith('path/not_found')) {
      return Response.json({ hasFiles: false, fileCount: 0 });
    }
    console.error('pending-status error', err);
    return Response.json({ error: 'lookup failed' }, { status: 500 });
  }
}