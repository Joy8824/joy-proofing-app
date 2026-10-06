export const MAX_PROOF_SIDE = 900;

export async function resizeImageForProof(file, maxSide = MAX_PROOF_SIDE) {
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
    throw new Error(`"${file.name}" isn't a PNG or JPG. Please upload a PNG or JPG image.`);
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`Couldn't open "${file.name}" to resize it. Please resize it yourself and upload it again.`);
  }

  const { width, height } = bitmap;
  const longest = Math.max(width, height);

  // Already small enough: upload the original untouched
  if (longest <= maxSide) {
    bitmap.close();
    return file;
  }

  const scale = maxSide / longest;
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, file.type, 0.9));
  if (!blob) {
    throw new Error(`Couldn't resize "${file.name}". Please resize it yourself and upload it again.`);
  }

  return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
}