import { getDropboxClient } from '@/lib/dropbox';

export async function getProofStatus(orderNumber) {
  const dbx = getDropboxClient();
  const folderPath = `/${orderNumber}/Proof`;

  let entries;
  try {
    const result = await dbx.filesListFolder({ path: folderPath });
    entries = result.result.entries;
  } catch {
    return { hasProof: false, decision: null };
  }

  const proofFiles = entries.filter(
    (e) => e['.tag'] === 'file' && e.name !== '.decision.json'
  );

  if (!proofFiles.length) {
    return { hasProof: false, decision: null };
  }

  const latestProof = proofFiles.sort(
    (a, b) => new Date(b.server_modified) - new Date(a.server_modified)
  )[0];

  const markerEntry = entries.find((e) => e.name === '.decision.json');
  if (!markerEntry) {
    return { hasProof: true, decision: null };
  }

  try {
    const download = await dbx.filesDownload({ path: `${folderPath}/.decision.json` });
    const marker = JSON.parse(download.result.fileBinary.toString('utf8'));

    const decisionTime = new Date(marker.decidedAt);
    const proofTime = new Date(latestProof.server_modified);

    if (decisionTime >= proofTime) {
      return { hasProof: true, decision: marker.decision };
    }
    return { hasProof: true, decision: null };
  } catch (err) {
    console.error('Failed to read decision marker:', err);
    return { hasProof: true, decision: null };
  }
}