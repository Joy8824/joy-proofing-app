import { getDropboxClient } from '@/lib/dropbox';
import { lineFolderName } from '@/lib/proofFolders';

const FILE_PATTERN = /^set-(\d+)-(graphic|overlay)\.(png|jpg)$/i;

const emptyState = () => ({ quantities: {}, done: false, doneAt: null });
const statePath = (orderNumber) => `/${orderNumber}/.proof-state.json`;

export async function readProofState(orderNumber) {
  const dbx = getDropboxClient();
  try {
    const download = await dbx.filesDownload({ path: statePath(orderNumber) });
    let text;
    if (download.result.fileBlob) {
      text = await download.result.fileBlob.text();
    } else if (download.result.fileBinary) {
      text = download.result.fileBinary.toString('utf8');
    } else {
      return emptyState();
    }
    return { ...emptyState(), ...JSON.parse(text) };
  } catch (err) {
    if (err?.status === 409) return emptyState(); // no file yet
    throw err;
  }
}

export async function writeProofState(orderNumber, state) {
  const dbx = getDropboxClient();
  await dbx.filesUpload({
    path: statePath(orderNumber),
    contents: JSON.stringify(state),
    mode: { '.tag': 'overwrite' },
  });
}

// Which sets exist for a product, and whether each has both images
export async function listSetsForItem(orderNumber, item) {
  const dbx = getDropboxClient();
  const folderPath = `/${orderNumber}/Proof/${lineFolderName(item)}`;

  let entries;
  try {
    const result = await dbx.filesListFolder({ path: folderPath });
    entries = result.result.entries.filter((e) => e['.tag'] === 'file');
  } catch (err) {
    if (err?.status === 409) return [];
    throw err;
  }

  const bySet = {};
  for (const entry of entries) {
    const match = entry.name.match(FILE_PATTERN);
    if (!match) continue;
    const n = Number(match[1]);
    const kind = match[2].toLowerCase();
    bySet[n] = bySet[n] || { set: n, graphic: false, overlay: false };
    bySet[n][kind] = true;
  }
  return Object.values(bySet).sort((a, b) => a.set - b.set);
}