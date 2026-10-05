import { getDropboxClient } from '@/lib/dropbox';
import { verifyOrderToken } from '@/lib/shopify';

function messagePage(title, text, status) {
  const html = `<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Joy Displays</title></head>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#4a4a4a;text-align:center;padding:80px 24px;">
    <h1 style="font-size:22px;text-transform:uppercase;">${title}</h1>
    <p>${text}</p>
  </body>
</html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html' } });
}

export async function GET(request, { params }) {
  const { orderNumber } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  try {
    const isValid = await verifyOrderToken(orderNumber, token);
    if (!isValid) {
      return messagePage('Link Not Valid', "This link has expired or isn't valid. Please contact us for a new one.", 403);
    }
  } catch (err) {
    console.error('Token verification error:', err);
    return messagePage('Something Went Wrong', 'We could not verify this link right now. Please try again in a moment.', 500);
  }

  const dbx = getDropboxClient();
  const folderPath = `/${orderNumber}/Proof`;

  try {
    const result = await dbx.filesListFolder({ path: folderPath });
    const files = result.result.entries.filter(
      (e) => e['.tag'] === 'file' && e.name !== '.decision.json'
    );

    if (!files.length) {
      return messagePage('No Proof Yet', "There isn't a proof to download for this order yet.", 404);
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

    const downloadUrl = new URL(shareUrl);
    downloadUrl.searchParams.set('dl', '1');

    return Response.redirect(downloadUrl.toString(), 302);
  } catch (err) {
    console.error('Download route error:', err);
    return messagePage('Something Went Wrong', 'We could not load this proof right now. Please try again in a moment.', 500);
  }
}