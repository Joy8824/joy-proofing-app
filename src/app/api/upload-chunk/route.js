import { getDropboxClient } from '@/lib/dropbox';
import { verifyOrderToken } from '@/lib/shopify';

const FOLDER_CONFIG = {
  customer: { path: 'Customer' },
  proof: { path: 'Proof' },
  finishedphotos: { path: 'Finished Photos' },
};

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error('FormData parse error:', err);
    return Response.json({ error: 'Failed to read upload data' }, { status: 400 });
  }

  const chunk = formData.get('chunk');
  const orderNumber = formData.get('orderNumber');
  const folderType = formData.get('folderType');
  const fileName = formData.get('fileName');
  const token = formData.get('token');
  const offset = Number(formData.get('offset'));
  const action = formData.get('action');
  const sessionId = formData.get('sessionId');

  const config = FOLDER_CONFIG[folderType];
  if (!chunk || !orderNumber || !config || !fileName) {
    return Response.json({ error: 'Missing or invalid data' }, { status: 400 });
  }

  if (action === 'start' || action === 'single') {
    try {
      const isValid = await verifyOrderToken(orderNumber, token);
      if (!isValid) {
        return Response.json({ error: 'Invalid or expired link' }, { status: 403 });
      }
    } catch (err) {
      console.error('Token verification error:', err);
      return Response.json({ error: 'Could not verify link right now' }, { status: 500 });
    }
  }

  const buffer = Buffer.from(await chunk.arrayBuffer());
  const dbx = getDropboxClient();
  const filePath = `/${orderNumber}/${config.path}/${fileName}`;

  try {
    if (action === 'single') {
      await dbx.filesUpload({ path: filePath, contents: buffer, mode: { '.tag': 'add' }, autorename: true });
      return Response.json({ success: true });
    }
    if (action === 'start') {
      const result = await dbx.filesUploadSessionStart({ contents: buffer, close: false });
      return Response.json({ sessionId: result.result.session_id });
    }
    if (action === 'append') {
      await dbx.filesUploadSessionAppendV2({ cursor: { session_id: sessionId, offset }, contents: buffer, close: false });
      return Response.json({ success: true });
    }
    if (action === 'finish') {
      await dbx.filesUploadSessionFinish({
        cursor: { session_id: sessionId, offset },
        commit: { path: filePath, mode: { '.tag': 'add' }, autorename: true },
        contents: buffer,
      });
      return Response.json({ success: true });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Chunk upload error:', err);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}