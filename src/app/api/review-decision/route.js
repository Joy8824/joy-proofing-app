export async function POST(request) {
  const { orderNumber, decision, comment } = await request.json();
  if (!orderNumber || !decision) {
    return Response.json({ error: 'Missing data' }, { status: 400 });
  }

  try {
    await fetch('https://hook.us2.make.com/3a9db2qthh9t0vda3pvok9rrbue2nkeq', {
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