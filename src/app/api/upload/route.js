import { getDropboxClient } from '@/lib/dropbox';

const FOLDER_CONFIG = {
  customer: { path: 'Customer', label: 'Customer uploaded graphic', linkTarget: 'folder' },
  proof: { path: 'Proof', label: 'Proof uploaded', linkTarget: 'file' },
  finishedphotos: { path: 'Finished Photos', label: 'Finished photos added', linkTarget: 'folder' },
};

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');
  const orderNumber = formData.get('orderNumber');
  const folderType = formData.get('folderType');
  const notify = formData.get('notify') !== 'false';

  const config = FOLDER_CONFIG[folderType];
  if (!file || !orderNumber || !config) {
    return Response.json({ error: 'Missing or invalid data' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dbx = getDropboxClient();
  const filePath = `/${orderNumber}/${config.path}/${file.name}`;

  try {
    await dbx.filesUpload({
      path: filePath,
      contents: buffer,
      mode: { '.tag': 'add' },
      autorename: true,
    });

    if (notify) {
      const linkPath = config.linkTarget === 'folder'
        ? `/${orderNumber}/${config.path}`
        : filePath;

      let shareUrl;
      try {
        const linkResult = await dbx.sharingCreateSharedLinkWithSettings({ path: linkPath });
        shareUrl = linkResult.result.url;
      } catch {
        const existing = await dbx.sharingListSharedLinks({ path: linkPath, direct_only: true });
        shareUrl = existing.result.links[0]?.url;
      }

      const uploadDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });

      await fetch('https://hook.us2.make.com/3a9db2qthh9t0vda3pvok9rrbue2nkeq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber, folderType,
          fileLink: shareUrl, uploadDate, label: config.label,
        }),
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Upload error:', err);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}