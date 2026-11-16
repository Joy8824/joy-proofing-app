import { verifyOrderToken, getOrderProducts } from '@/lib/shopify';
import { lineFolderName } from '@/lib/proofFolders';
import { readCustomerUploads } from '@/lib/customerUploads';

// Customer-facing list of the items in an order that need graphics.
// Access: the order's token (same check as the other customer routes).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber');
  const token = searchParams.get('token');

  if (!orderNumber || !/^[A-Za-z0-9-]{1,20}$/.test(orderNumber)) {
    return Response.json({ error: 'Missing or invalid order number' }, { status: 400 });
  }

  try {
    const isValid = await verifyOrderToken(orderNumber, token);
    if (!isValid) {
      return Response.json({ error: 'Invalid or expired link' }, { status: 403 });
    }

    const result = await getOrderProducts(orderNumber);
    if (!result) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // What the customer has already uploaded for each item, and for how many.
    const uploadState = await readCustomerUploads(orderNumber);

    // Hardware Only, Attention Needed and Graphic Services items never need a
    // customer graphic, so the customer does not see them.
    const items = result.items
      .filter((item) => item.needsGraphics)
      .map((item) => {
        // Same folder name the staff proofing pages use, so both sides line up.
        const folder = lineFolderName(item);
        return {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          folder,
          uploads: (uploadState.items[folder] || []).map((upload) => ({
            fileName: upload.fileName,
            quantity: upload.quantity,
          })),
        };
      });

    return Response.json({ orderName: result.orderName, items });
  } catch (err) {
    console.error('Order items error:', err);
    return Response.json({ error: 'Could not load this order right now' }, { status: 500 });
  }
}
