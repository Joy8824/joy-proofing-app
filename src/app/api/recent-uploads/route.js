import { getDropboxClient } from '@/lib/dropbox';

export async function GET() {
  const dbx = getDropboxClient();
  const result = await dbx.filesListFolder({ path: '', recursive: true });

  const cutoff = Date.now() - 2 * 60 * 1000; // last 2 minutes

  const recent = result.result.entries.filter((entry) => {
    if (entry['.tag'] !== 'file') return false;
    if (!entry.path_lower.includes('/customer/')) return false;
    return new Date(entry.server_modified).getTime() > cutoff;
  });

  return Response.json(recent.map((f) => ({ id: f.id, name: f.name, path: f.path_display })));
}