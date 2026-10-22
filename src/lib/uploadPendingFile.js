const CHUNK_SIZE = 4 * 1024 * 1024;

export async function uploadPendingFile(file, uploadId, onProgress) {
  if (!file.size) throw new Error(`${file.name} is empty.`);

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
    formData.append('uploadId', uploadId);
    formData.append('fileName', file.name);
    formData.append('offset', String(offset));
    formData.append('action', action);
    if (sessionId) formData.append('sessionId', sessionId);

    const res = await fetch('/api/pending-upload-chunk', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    if (action === 'start') sessionId = data.sessionId;
    offset += chunk.size;
    if (onProgress) onProgress(offset / file.size);
  }
}