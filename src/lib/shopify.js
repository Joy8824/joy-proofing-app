let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SHOPIFY_CLIENT_ID,
    client_secret: process.env.SHOPIFY_CLIENT_SECRET,
  });

  const response = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Failed to get Shopify access token');
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export async function shopifyAdminQuery(query, variables = {}) {
  const token = await getAccessToken();

  const response = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  return response.json();
}

export async function verifyOrderToken(orderNumber, token) {
  if (!token) return false;

  const query = `
    query FindOrder($q: String!) {
      orders(first: 1, query: $q) {
        edges {
          node {
            id
            metafield(namespace: "custom", key: "access_token") {
              value
            }
          }
        }
      }
    }
  `;

  const data = await shopifyAdminQuery(query, { q: `name:#${orderNumber}` });
  const order = data?.data?.orders?.edges?.[0]?.node;

  if (!order || !order.metafield) return false;
  return order.metafield.value === token;
}