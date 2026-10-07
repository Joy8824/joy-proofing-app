import { verifyStaffKey } from '@/lib/staffAuth';
import { getOrderProducts } from '@/lib/shopify';
import { readProofState, writeProofState, listSetsForItem } from '@/lib/proofState';
import { checkProof } from '@/lib/proofCheck';

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
    return Response.json(await readProofState(orderNumber));
  } catch (err) {
    console.error('Read proof state error:', err);
    return Response.json({ error: 'Could not load saved quantities' }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { key, orderNumber, action, quantities } = body;

  if (!verifyStaffKey(key)) {
    return Response.json({ error: 'Not authorized' }, { status: 403 });
  }
  if (!orderNumber || !/^\d+$/.test(String(orderNumber))) {
    return Response.json({ error: 'Missing order number' }, { status: 400 });
  }

  try {
    const order = await getOrderProducts(orderNumber);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    const items = order.items.filter((i) => !i.hardwareOnly);

    if (action === 'save') {
      // Keep only real products, whole-number set numbers and whole-number quantities
      const clean = {};
      for (const item of items) {
        const given = quantities?.[item.id];
        if (!given || typeof given !== 'object') continue;
        clean[item.id] = {};
        for (const [n, v] of Object.entries(given)) {
          const setNum = Number(n);
          if (
            Number.isInteger(setNum) && setNum >= 1 && setNum <= 50 &&
            Number.isInteger(v) && v >= 1 && v <= 9999
          ) {
            clean[item.id][setNum] = v;
          }
        }
      }
      // Changing a quantity reopens DONE
      await writeProofState(orderNumber, { quantities: clean, done: false, doneAt: null });
      return Response.json({ success: true });
    }

    if (action === 'done') {
      const state = await readProofState(orderNumber);
      const setsByItem = {};
      await Promise.all(
        items.map(async (item) => {
          setsByItem[item.id] = await listSetsForItem(orderNumber, item);
        })
      );

      const result = checkProof(items, setsByItem, state.quantities || {});
      if (!result.ok) {
        const problems = Object.entries(result.perItem).flatMap(([id, r]) => {
          const item = items.find((i) => i.id === id);
          return r.problems.map((p) => `${item.name}: ${p}`);
        });
        return Response.json({ error: 'Not ready yet', problems }, { status: 400 });
      }

      await writeProofState(orderNumber, { ...state, done: true, doneAt: new Date().toISOString() });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Proof state error:', err);
    return Response.json({ error: 'Could not save right now' }, { status: 500 });
  }
}