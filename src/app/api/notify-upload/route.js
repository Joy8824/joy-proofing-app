const FOLDER_CONFIG = {
  customer: { path: 'Customer', label: 'Customer uploaded graphic' },
  proof: { path: 'Proof', label: 'Proof uploaded' },
  finishedphotos: { path: 'Finished Photos', label: 'Finished photos added' },
};

import { getDropboxClient } from '@/lib/dropbox';

export async function POST(request) {
  const { orderNumber, folderType } = await request.json();
  const config = FOLDER_CONFIG[folderType];
  if (!orderNumber || !config) {
    return Response.json({ error: 'Missing or invalid data' }, { status: 400 });
  }

  const dbx = getDropboxClient();
  const folderPath = `/${orderNumber}/${config.path}`;

  let shareUrl;
  try {
    const linkResult = await dbx.sharingCreateSharedLinkWithSettings({ path: folderPath });
    shareUrl = linkResult.result.url;
  } catch {
    const existing = await dbx.sharingListSharedLinks({ path: folderPath, direct_only: true });
    shareUrl = existing.result.links[0]?.url;
  }

  const uploadDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  await fetch('https://hook.us2.make.com/3a9db2qthh9t0vda3pvok9rrbue2nkeq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNumber, folderType, fileLink: shareUrl, uploadDate, label: config.label }),
  });

  return Response.json({ success: true });
}