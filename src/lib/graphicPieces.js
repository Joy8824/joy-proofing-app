import { shopifyAdminQuery } from '@/lib/shopify';

// Graphic pieces: the printable sizes a variant is made of.
//
// Each variant can have a JSON metafield, custom.graphic_pieces, listing the
// pieces it uses:
//   [{ "piece": "sego-lightbox-100x225", "qty": 1, "sides": 2, "label": "Back" }]
// "piece" is the handle of a "graphic_piece" metaobject entry, which holds the
// size (brand, name, width, height, unit, scale, template file). "qty" and
// "sides" default to 1, and "label" is optional.

const PIECE_TYPE = 'graphic_piece';
const HANDLE_PATTERN = /^[a-z0-9-]{1,100}$/;

// Turns the metafield's text into a clean list. Lines that can't be read are
// skipped and reported in `problems`, so one typo doesn't break the page.
export function parsePieceList(raw) {
  const problems = [];
  if (!raw) return { lines: [], problems };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { lines: [], problems: ['The graphic pieces list is not valid JSON.'] };
  }
  if (!Array.isArray(parsed)) {
    return { lines: [], problems: ['The graphic pieces list should be a list in [ ].'] };
  }

  const lines = [];
  parsed.forEach((entry, i) => {
    const piece = String(entry?.piece || '').trim();
    const qty = entry?.qty === undefined ? 1 : Number(entry.qty);
    const sides = entry?.sides === undefined ? 1 : Number(entry.sides);
    const label = entry?.label ? String(entry.label).trim().slice(0, 40) : '';

    if (!HANDLE_PATTERN.test(piece)) {
      problems.push(`Line ${i + 1}: "piece" is missing or not a valid handle.`);
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      problems.push(`Line ${i + 1}: "qty" should be a whole number of 1 or more.`);
      return;
    }
    if (sides !== 1 && sides !== 2) {
      problems.push(`Line ${i + 1}: "sides" should be 1 or 2.`);
      return;
    }
    lines.push({ piece, qty, sides, label });
  });

  return { lines, problems };
}

// Looks up the graphic_piece entries for a set of handles in one request.
// Returns a map of handle -> piece details. Handles with no entry are left out.
export async function getPieceEntries(handles) {
  const unique = [...new Set(handles)].filter((h) => HANDLE_PATTERN.test(h));
  if (unique.length === 0) return {};

  const variableDefs = unique.map((_, i) => `$h${i}: String!`).join(', ');
  const lookups = unique
    .map(
      (_, i) => `
      p${i}: metaobjectByHandle(handle: { type: "${PIECE_TYPE}", handle: $h${i} }) {
        handle
        fields { key value }
      }`
    )
    .join('\n');
  const variables = Object.fromEntries(unique.map((h, i) => [`h${i}`, h]));

  const data = await shopifyAdminQuery(`query Pieces(${variableDefs}) {${lookups}\n}`, variables);
  if (data.errors) {
    throw new Error('Shopify API error: ' + JSON.stringify(data.errors));
  }

  const entries = {};
  unique.forEach((_, i) => {
    const node = data?.data?.[`p${i}`];
    if (!node) return;
    const fields = Object.fromEntries(node.fields.map((f) => [f.key, f.value]));
    const templateKey = Object.keys(fields).find((key) => key.startsWith('template'));
    entries[node.handle] = {
      name: fields.name || node.handle,
      brand: fields.brand || '',
      width: Number(fields.width) || null,
      height: Number(fields.height) || null,
      unit: fields.unit || '',
      scale: Number(fields.scale) || 100,
      templateUrl: templateKey ? fields[templateKey] : '',
    };
  });
  return entries;
}

// One upload slot per piece line and side. `needed` is how many graphics that
// slot covers across the whole order line: the piece's qty in one unit times
// the number of units ordered.
export function buildSlots(lines, entries, orderedQuantity) {
  const slots = [];
  lines.forEach((line, i) => {
    const entry = entries[line.piece];
    const sideNames = line.sides === 2 ? ['Front', 'Back'] : [''];
    sideNames.forEach((side) => {
      const tags = [side, line.label].filter(Boolean);
      slots.push({
        key: [i + 1, line.piece, side.toLowerCase()].filter(Boolean).join('-'),
        piece: line.piece,
        found: Boolean(entry),
        name: entry ? entry.name : line.piece,
        tag: tags.join(' · '),
        width: entry?.width ?? null,
        height: entry?.height ?? null,
        unit: entry?.unit ?? '',
        scale: entry?.scale ?? 100,
        needed: line.qty * orderedQuantity,
      });
    });
  });
  return slots;
}
