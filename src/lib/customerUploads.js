import { getDropboxClient } from '@/lib/dropbox';

// Record of what the customer uploaded for each item and how many of that item
// each graphic covers. Kept beside the order's folders in Dropbox:
//   /{orderNumber}/.customer-uploads.json
//   { items: { [itemFolder]: [{ fileName, quantity, uploadedAt }] } }

const emptyState = () => ({ items: {} });
const statePath = (orderNumber) => `/${orderNumber}/.customer-uploads.json`;

export async function readCustomerUploads(orderNumber) {
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

export async function writeCustomerUploads(orderNumber, state) {
  const dbx = getDropboxClient();
  await dbx.filesUpload({
    path: statePath(orderNumber),
    contents: JSON.stringify(state),
    mode: { '.tag': 'overwrite' },
  });
}

// How many of an item the recorded uploads already cover
export function coveredQuantity(uploads) {
  return (uploads || []).reduce((sum, upload) => sum + (Number(upload.quantity) || 0), 0);
}
