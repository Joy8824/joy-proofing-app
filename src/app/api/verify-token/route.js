import { verifyOrderToken } from '@/lib/shopify';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber');
  const token = searchParams.get('token');

  try {
    const isValid = await verifyOrderToken(orderNumber, token);
    return Response.json({ valid: isValid });
  } catch (err) {
    console.error('Verify-token error:', err);
    return Response.json({ valid: false });
  }
}