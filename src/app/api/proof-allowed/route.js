import { verifyOrderToken, getOrderStage } from '@/lib/shopify';
import { PROOF_UPLOAD_STAGE } from '@/lib/proofStage';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber');
  const token = searchParams.get('token');

  try {
    const valid = await verifyOrderToken(orderNumber, token);
    if (!valid) return Response.json({ allowed: false }, { status: 403 });

    const stage = await getOrderStage(orderNumber);
    return Response.json({ allowed: stage === PROOF_UPLOAD_STAGE });
  } catch (err) {
    console.error('Proof allowed check error:', err);
    return Response.json({ error: 'Could not check right now' }, { status: 500 });
  }
}