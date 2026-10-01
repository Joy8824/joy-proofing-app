import { getDropboxClient } from '@/lib/dropbox';

const FOLDER_CONFIG = {
  customer: { path: 'Customer', label: 'Customer uploaded graphic' },
  proof: { path: 'Proof', label: 'Proof uploaded' },
  finishedphotos: { path: 'Finished Photos', label: 'Finished photos added' },
};

export async function POST(request) {
  const { orderNumber, folderType, fileName } = await request.json();
  const config = FOLDER_CONFIG[folderType];
  if (!orderNumber || !config) {
    return Response.json({ error: 'Missing or invalid data' }, { status: 400 });
  }

  const dbx = getDropboxClient();
  const folderPath = `/${orderNumber}/${config.path}`;

  async function getShareUrl(path) {
    try {
      const linkResult = await dbx.sharingCreateSharedLinkWithSettings({ path });
      return linkResult.result.url;
    } catch {
      const existing = await dbx.sharingListSharedLinks({ path, direct_only: true });
      return existing.result.links[0]?.url;
    }
  }

  const folderLink = await getShareUrl(folderPath);

  let proofFileLink = null;
  if (folderType === 'proof' && fileName) {
    proofFileLink = await getShareUrl(`${folderPath}/${fileName}`);
  }

  const uploadDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  await fetch('https://hook.us2.make.com/3a9db2qthh9t0vda3pvok9rrbue2nkeq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderNumber, folderType,
      fileLink: folderLink,
      proofFileLink,
      uploadDate, label: config.label,
    }),
  });

  return Response.json({ success: true });
}