import { verifyOrderToken, getOrderProducts } from '@/lib/shopify';
import { lineFolderName } from '@/lib/proofFolders';
import { readCustomerUploads, writeCustomerUploads, coveredQuantity } from '@/lib/customerUploads';

// Records that a customer's graphic was uploaded for an item, and how many of
// that item it covers. Called by the per-item upload page after each upload.
// Access: the order's token.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Missing or invalid data' }, { status: 400 });
  }

  const orderNumber = String(body.orderNumber || '');
  const itemFolder = String(body.itemFolder || '');
  const fileName = String(body.fileName || '').slice(0, 150);
  const quantity = Number(body.quantity);

  if (
    !/^[A-Za-z0-9-]{1,20}$/.test(orderNumber) ||
    !/^[a-z0-9-]{1,60}$/.test(itemFolder) ||
    !fileName ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return Response.json({ error: 'Missing or invalid data' }, { status: 400 });
  }

  try {
    const isValid = await verifyOrderToken(orderNumber, body.token);
    if (!isValid) {
      return Response.json({ error: 'Invalid or expired link' }, { status: 403 });
    }

    const order = await getOrderProducts(orderNumber);
    const item = order?.items.find(
      (candidate) => candidate.needsGraphics && lineFolderName(candidate) === itemFolder
    );
    if (!item) {
      return Response.json({ error: 'This item is not part of the order.' }, { status: 400 });
    }

    const state = await readCustomerUploads(orderNumber);
    const uploads = state.items[itemFolder] || [];
    const remaining = item.quantity - coveredQuantity(uploads);
    if (quantity > remaining) {
      return Response.json(
        { error: `Only ${remaining} of this item still ${remaining === 1 ? 'needs' : 'need'} a graphic.` },
        { status: 400 }
      );
    }

    uploads.push({ fileName, quantity, uploadedAt: new Date().toISOString() });
    state.items[itemFolder] = uploads;
    await writeCustomerUploads(orderNumber, state);

    return Response.json({ uploads });
  } catch (err) {
    console.error('Item uploads error:', err);
    return Response.json({ error: 'Could not save this upload right now' }, { status: 500 });
  }
}
