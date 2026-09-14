import { getDropboxClient } from '@/lib/dropbox';

export async function GET() {
  const dbx = getDropboxClient();
  const response = await dbx.filesListFolder({ path: '' });
  return Response.json(response.result.entries);
}