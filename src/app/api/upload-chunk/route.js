import { getDropboxClient } from '@/lib/dropbox';
import { verifyOrderToken, getOrderStage, getOrderProducts } from '@/lib/shopify';
import { lineFolderName } from '@/lib/proofFolders';
import { PROOF_UPLOAD_STAGE } from '@/lib/proofStage';

const FOLDER_CONFIG = {
  customer: { path: 'Customer' },
  proof: { path: 'Proof' },
  finishedphotos: { path: 'Finished Photos' },
};

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
  const orderNumber = formData.get('orderNumber');
  const folderType = formData.get('folderType');
  const fileName = safeName(formData.get('fileName') || '');
  const token = formData.get('token');
  const offset = Number(formData.get('offset'));
  const action = formData.get('action');
  const sessionId = formData.get('sessionId');
  // Optional: an item's own subfolder inside the Customer folder (per-item uploads).
  const itemFolder = formData.get('itemFolder') ? String(formData.get('itemFolder')) : '';

  const config = FOLDER_CONFIG[folderType];
  if (!chunk || !orderNumber || !config || !fileName) {
    return Response.json({ error: 'Missing or invalid data' }, { status: 400 });
  }
  if (!/^[A-Za-z0-9-]{1,20}$/.test(String(orderNumber))) {
  return Response.json({ error: 'Missing or invalid data' }, { status: 400 });
}

  if (itemFolder && (folderType !== 'customer' || !/^[a-z0-9-]{1,60}$/.test(itemFolder))) {
    return Response.json({ error: 'Missing or invalid data' }, { status: 400 });
  }

    if (action === 'start' || action === 'single' || action === 'finish') {
    try {
      const isValid = await verifyOrderToken(orderNumber, token);
      if (!isValid) {
        return Response.json({ error: 'Invalid or expired link' }, { status: 403 });
      }
      if (itemFolder) {
        // The subfolder must belong to an item in this order that needs graphics.
        const order = await getOrderProducts(orderNumber);
        const belongs = order?.items.some(
          (item) => item.needsGraphics && lineFolderName(item) === itemFolder
        );
        if (!belongs) {
          return Response.json({ error: 'This item is not part of the order.' }, { status: 400 });
        }
      }
      if (folderType === 'proof') {
        const stage = await getOrderStage(orderNumber);
        if (stage !== PROOF_UPLOAD_STAGE) {
          return Response.json(
            { error: 'This order is not ready for a proof upload yet.' },
            { status: 403 }
          );
        }
      }
    } catch (err) {
      console.error('Token verification error:', err);
      return Response.json({ error: 'Could not verify link right now' }, { status: 500 });
    }

  }

  const buffer = Buffer.from(await chunk.arrayBuffer());
  const dbx = getDropboxClient();
  const filePath = itemFolder
    ? `/${orderNumber}/${config.path}/${itemFolder}/${fileName}`
    : `/${orderNumber}/${config.path}/${fileName}`;

  try {
    if (action === 'single') {
      await dbx.filesUpload({ path: filePath, contents: buffer, mode: { '.tag': 'add' }, autorename: true });
      if (folderType === 'proof') {
        try {
          await dbx.filesDeleteV2({ path: `/${orderNumber}/Proof/.decision.json` });
        } catch {
          // nothing to delete, that's fine
        }
      }
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
      if (folderType === 'proof') {
        try {
          await dbx.filesDeleteV2({ path: `/${orderNumber}/Proof/.decision.json` });
        } catch {
          // nothing to delete, that's fine
        }
      }
      return Response.json({ success: true });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Chunk upload error:', err);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}