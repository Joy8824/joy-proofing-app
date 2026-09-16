import { getDropboxClient } from '@/lib/dropbox';
import { verifyOrderToken } from '@/lib/shopify';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber');
  const token = searchParams.get('token');

  if (!orderNumber) {
    return Response.json({ error: 'Missing order number' }, { status: 400 });
  }

  try {
    const isValid = await verifyOrderToken(orderNumber, token);
    if (!isValid) {
      return Response.json({ error: 'Invalid or expired link' }, { status: 403 });
    }
  } catch (err) {
    console.error('Token verification error:', err);
    return Response.json({ error: 'Could not verify link right now' }, { status: 500 });
  }

  const dbx = getDropboxClient();
  const folderPath = `/${orderNumber}/Proof`;

  try {
    const result = await dbx.filesListFolder({ path: folderPath });
    const files = result.result.entries.filter((e) => e['.tag'] === 'file');
    if (!files.length) {
      return Response.json({ error: 'No proof found' }, { status: 404 });
    }

    const latest = files.sort(
      (a, b) => new Date(b.server_modified) - new Date(a.server_modified)
    )[0];

    let shareUrl;
    try {
      const linkResult = await dbx.sharingCreateSharedLinkWithSettings({ path: latest.path_lower });
      shareUrl = linkResult.result.url;
    } catch {
      const existing = await dbx.sharingListSharedLinks({ path: latest.path_lower, direct_only: true });
      shareUrl = existing.result.links[0]?.url;
    }

    return Response.json({ fileName: latest.name, embedUrl: shareUrl.replace(/dl=0|dl=1/g, 'raw=1') });
  } catch (err) {
    console.error('Proof fetch error:', err);
    return Response.json({ error: 'Failed to load proof' }, { status: 500 });
  }
}