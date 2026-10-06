import { verifyStaffKey } from '@/lib/staffAuth';
import { getOrderProducts } from '@/lib/shopify';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber');
  const key = searchParams.get('key');

  if (!verifyStaffKey(key)) {
    return Response.json({ error: 'Not authorized' }, { status: 403 });
  }
  if (!orderNumber) {
    return Response.json({ error: 'Missing order number' }, { status: 400 });
  }

  try {
    const result = await getOrderProducts(orderNumber);
    if (!result) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    console.error('Order products error:', err);
    return Response.json({ error: 'Could not load products right now' }, { status: 500 });
  }
}