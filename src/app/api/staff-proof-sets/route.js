import { getDropboxClient } from '@/lib/dropbox';
import { verifyStaffKey } from '@/lib/staffAuth';
import { getOrderProducts } from '@/lib/shopify';
import { lineFolderName } from '@/lib/proofFolders';

const FILE_PATTERN = /^set-(\d+)-(graphic|overlay)\.(png|jpg)$/i;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber');

  if (!verifyStaffKey(searchParams.get('key'))) {
    return Response.json({ error: 'Not authorized' }, { status: 403 });
  }
  if (!orderNumber || !/^\d+$/.test(orderNumber)) {
    return Response.json({ error: 'Missing order number' }, { status: 400 });
  }

  try {
    const order = await getOrderProducts(orderNumber);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    const dbx = getDropboxClient();
    const sets = {};

    await Promise.all(
      order.items.filter((i) => !i.hardwareOnly).map(async (item) => {
        const folderPath = `/${orderNumber}/Proof/${lineFolderName(item)}`;

        let entries;
        try {
          const result = await dbx.filesListFolder({ path: folderPath });
          entries = result.result.entries.filter((e) => e['.tag'] === 'file');
        } catch (err) {
          if (err?.status === 409) {
            sets[item.id] = []; // folder doesn't exist yet
            return;
          }
          throw err;
        }

        const bySet = {};
        await Promise.all(
          entries.map(async (entry) => {
            const match = entry.name.match(FILE_PATTERN);
            if (!match) return;
            const n = Number(match[1]);
            const kind = match[2].toLowerCase();
            const link = await dbx.filesGetTemporaryLink({ path: entry.path_lower });
            bySet[n] = bySet[n] || { set: n, graphic: null, overlay: null };
            bySet[n][kind] = { name: entry.name, url: link.result.link };
          })
        );

        sets[item.id] = Object.values(bySet).sort((a, b) => a.set - b.set);
      })
    );

    return Response.json({ sets });
  } catch (err) {
    console.error('Staff proof sets error:', err);
    return Response.json({ error: 'Could not load uploaded proofs' }, { status: 500 });
  }
}