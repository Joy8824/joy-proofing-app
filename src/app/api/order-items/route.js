import { verifyOrderToken, getOrderProducts } from '@/lib/shopify';
import { lineFolderName } from '@/lib/proofFolders';
import { readCustomerUploads } from '@/lib/customerUploads';
import { parsePieceList, getPieceEntries, buildSlots } from '@/lib/graphicPieces';

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
    const graphicItems = result.items.filter((item) => item.needsGraphics);

    // The pieces each item's variant is made of, from custom.graphic_pieces,
    // with their sizes looked up from the graphic_piece entries.
    const pieceLists = graphicItems.map((item) => parsePieceList(item.graphicPieces));
    const entries = await getPieceEntries(
      pieceLists.flatMap(({ lines }) => lines.map((line) => line.piece))
    );

    const items = graphicItems.map((item, index) => {
        // Same folder name the staff proofing pages use, so both sides line up.
        const folder = lineFolderName(item);
        const { lines, problems } = pieceLists[index];
        for (const problem of problems) {
          console.warn(`graphic_pieces on "${item.name}": ${problem}`);
        }
        return {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          folder,
          slots: buildSlots(lines, entries, item.quantity),
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
