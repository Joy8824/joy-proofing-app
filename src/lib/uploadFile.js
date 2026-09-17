const CHUNK_SIZE = 4 * 1024 * 1024;

export async function uploadFileInChunks(file, orderNumber, folderType, token, onProgress) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let sessionId = null;
  let offset = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    let action;
    if (totalChunks === 1) action = 'single';
    else if (i === 0) action = 'start';
    else if (i === totalChunks - 1) action = 'finish';
    else action = 'append';

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('orderNumber', orderNumber);
    formData.append('folderType', folderType);
    formData.append('fileName', file.name);
    formData.append('token', token);
    formData.append('offset', String(offset));
    formData.append('action', action);
    if (sessionId) formData.append('sessionId', sessionId);

    const res = await fetch('/api/upload-chunk', { method: 'POST', body: formData });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Upload failed');
    }
    const data = await res.json();
    if (action === 'start') sessionId = data.sessionId;
    offset += chunk.size;
    if (onProgress) onProgress(offset / file.size);
  }
}