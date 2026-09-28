import { verifyOrderToken } from '@/lib/shopify';
import { getProofStatus } from '@/lib/proofStatus';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber');
  const token = searchParams.get('token');

  try {
    const isValid = await verifyOrderToken(orderNumber, token);
    if (!isValid) {
      return Response.json({ error: 'Invalid or expired link' }, { status: 403 });
    }
    const status = await getProofStatus(orderNumber);
    return Response.json(status);
  } catch (err) {
    console.error('Upload status check error:', err);
    return Response.json({ error: 'Could not check status right now' }, { status: 500 });
  }
}