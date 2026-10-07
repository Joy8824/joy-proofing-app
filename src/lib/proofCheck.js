// Works with plain data only, so the page and the server can both use it.
export function checkProof(items, setsByItem, quantities) {
  const perItem = {};
  let ok = items.length > 0;

  for (const item of items) {
    const sets = setsByItem[item.id] || [];
    const entered = quantities[item.id] || {};
    const problems = [];
    let assigned = 0;
    let missingQty = false;

    if (sets.length === 0) problems.push('No proof uploaded yet.');

    for (const s of sets) {
      if (!s.graphic || !s.overlay) {
        problems.push(`Set ${s.set} needs both a graphic and an overlay.`);
      }
      const n = Number(entered[s.set]);
      if (!Number.isInteger(n) || n < 1) {
        missingQty = true;
        problems.push(`Set ${s.set} needs a quantity.`);
      } else {
        assigned += n;
      }
    }

    if (sets.length > 0 && !missingQty && assigned !== item.quantity) {
      problems.push(`Quantities add up to ${assigned}, but ${item.quantity} ordered.`);
    }

    if (problems.length > 0) ok = false;
    perItem[item.id] = { assigned, ordered: item.quantity, problems };
  }

  return { ok, perItem };
}