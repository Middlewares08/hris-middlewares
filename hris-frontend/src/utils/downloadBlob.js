// Triggers a browser download for a Blob (e.g. an axios `responseType: 'blob'` payload).
export function downloadBlob(blob, filename = 'download') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick so the click has a chance to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Pulls a filename out of a Content-Disposition header, falling back to `fallback`.
export function filenameFromHeaders(headers, fallback = 'download') {
    const cd = headers?.['content-disposition'] || headers?.get?.('content-disposition') || '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    return match ? decodeURIComponent(match[1]) : fallback;
}
