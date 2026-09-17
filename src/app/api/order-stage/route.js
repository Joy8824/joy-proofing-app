import { verifyOrderToken, getOrderStage } from '@/lib/shopify';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber');
  const token = searchParams.get('token');

  try {
    const isValid = await verifyOrderToken(orderNumber, token);
    if (!isValid) {
      return Response.json({ error: 'Invalid or expired link' }, { status: 403 });
    }
    const stage = await getOrderStage(orderNumber);
    return Response.json({ stage });
  } catch (err) {
    console.error('Order stage check error:', err);
    return Response.json({ error: 'Could not check status right now' }, { status: 500 });
  }
}