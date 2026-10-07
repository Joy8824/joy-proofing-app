import { getDropboxClient } from '@/lib/dropbox';
import { verifyStaffKey } from '@/lib/staffAuth';
import { getOrderProducts } from '@/lib/shopify';
import { lineFolderName } from '@/lib/proofFolders';
import { readProofState, writeProofState } from '@/lib/proofState';

const MAX_BYTES = 4 * 1024 * 1024;
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg' };

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Failed to read upload data' }, { status: 400 });
  }

  if (!verifyStaffKey(formData.get('key'))) {
    return Response.json({ error: 'Not authorized' }, { status: 403 });
  }

  const file = formData.get('file');
  const orderNumber = formData.get('orderNumber');
  const lineItemId = formData.get('lineItemId');
  const setNumber = Number(formData.get('set'));
  const kind = formData.get('kind');

  const ext = file && EXTENSIONS[file.type];
  if (
    !file || !ext ||
    !orderNumber || !/^\d+$/.test(orderNumber) ||
    !lineItemId ||
    !Number.isInteger(setNumber) || setNumber < 1 || setNumber > 50 ||
    !['graphic', 'overlay'].includes(kind)
  ) {
    return Response.json({ error: 'Missing or invalid data. Use a PNG or JPG.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'That image is too large. Please resize it and try again.' }, { status: 413 });
  }

  try {
    const order = await getOrderProducts(orderNumber);
    const item = order?.items.find((i) => i.id === lineItemId);
    if (!item) {
      return Response.json({ error: 'That product is not on this order.' }, { status: 404 });
    }

        // A new or replaced image reopens DONE. Do this first, so a failure can't leave a stale DONE.
    const state = await readProofState(orderNumber);
    if (state.done) {
      await writeProofState(orderNumber, { ...state, done: false, doneAt: null });
    }

    const dbx = getDropboxClient();
    const folderPath = `/${orderNumber}/Proof/${lineFolderName(item)}`;
    const baseName = `set-${setNumber}-${kind}`;

    // Remove any earlier version of this slot, whatever its format
    for (const e of ['png', 'jpg']) {
      try {
        await dbx.filesDeleteV2({ path: `${folderPath}/${baseName}.${e}` });
      } catch {
        // nothing there to delete
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await dbx.filesUpload({
      path: `${folderPath}/${baseName}.${ext}`,
      contents: buffer,
      mode: { '.tag': 'overwrite' },
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error('Staff proof upload error:', err);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}