import { verifyOrderToken, getOrderStage } from '@/lib/shopify';

export async function POST(request) {
  const { orderNumber, decision, comment, token } = await request.json();
  if (!orderNumber || !decision) {
    return Response.json({ error: 'Missing data' }, { status: 400 });
  }

  try {
    const isValid = await verifyOrderToken(orderNumber, token);
    if (!isValid) {
      return Response.json({ error: 'Invalid or expired link' }, { status: 403 });
    }
  } catch (err) {
    console.error('Token verification error:', err);
    return Response.json({ error: 'Could not verify link right now' }, { status: 500 });
  }

  try {
  const stage = await getOrderStage(orderNumber);
  if (stage && stage !== 'Proof Ready-Approve/Reject') {
    return Response.json({ error: 'This proof has already been reviewed.' }, { status: 409 });
  }
} catch (err) {
  console.error('Stage check error:', err);
  return Response.json({ error: 'Could not verify current status' }, { status: 500 });
}

  try {
    await fetch('https://hook.us2.make.com/f77r3lpcvi8x1dmlfh43axme7qrgn7l1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, decision, comment }),
    });
    return Response.json({ success: true });
  } catch (err) {
    console.error('Review decision error:', err);
    return Response.json({ error: 'Failed to submit decision' }, { status: 500 });
  }
}