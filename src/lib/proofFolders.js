export function lineFolderName(item) {
  const numericId = String(item.id).split('/').pop() || '';
  const shortId = numericId.slice(-6);
  const slug = item.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  return `${slug || 'product'}-${shortId}`;
}