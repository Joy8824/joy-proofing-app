import { getDropboxClient } from '@/lib/dropbox';

const ID_RE = /^[a-zA-Z0-9-]{20,64}$/;
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'tif', 'tiff', 'svg', 'eps', 'pdf', 'psd', 'ai'];
const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024; // 500 MB per cart

function safeName(name) {
  return String(name)
    .replace(/[\\/\u0000-\u001f]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 150);
}

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error('FormData parse error:', err);
    return Response.json({ error: 'Failed to read upload data' }, { status: 400 });
  }

  const chunk = formData.get('chunk');
  const uploadId = formData.get('uploadId');
  const rawName = formData.get('fileName');
  const offset = Number(formData.get('offset'));
  const action = formData.get('action');
  const sessionId = formData.get('sessionId');

  if (!chunk || !rawName || !uploadId || !ID_RE.test(uploadId)) {
    return Response.json({ error: 'Missing or invalid data' }, { status: 400 });
  }

  const fileName = safeName(rawName);
  const ext = fileName.split('.').pop().toLowerCase();
  if (!fileName || !ALLOWED_EXT.includes(ext)) {
    return Response.json({ error: 'This file type is not supported.' }, { status: 400 });
  }

  const dbx = getDropboxClient();
  const folder = `/Pending/${uploadId}`;
  const filePath = `${folder}/${fileName}`;

  // On the first request for a file, make sure this cart isn't over its limits
  if (action === 'start' || action === 'single') {
    try {
      let files = [];
      try {
        const res = await dbx.filesListFolder({ path: folder });
        files = res.result.entries.filter((e) => e['.tag'] === 'file');
      } catch {
        // folder doesn't exist yet, that's fine
      }
      const total = files.reduce((sum, f) => sum + (f.size || 0), 0);
      if (files.length >= MAX_FILES || total >= MAX_TOTAL_BYTES) {
        return Response.json(
          { error: 'Upload limit reached for this cart. Please contact us for help.' },
          { status: 413 }
        );
      }
    } catch (err) {
      console.error('Pending limit check error:', err);
      return Response.json({ error: 'Could not start the upload right now' }, { status: 500 });
    }
  }

  const buffer = Buffer.from(await chunk.arrayBuffer());

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
    console.error('Pending chunk upload error:', err);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}