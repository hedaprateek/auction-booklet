// Photos are downscaled in the browser before they are embedded, so a booklet
// with 200 players stays a few MB instead of a few hundred.

const MAX_EDGE = 560;
const QUALITY = 0.82;

export function resizeToDataURL(blob, maxEdge = MAX_EDGE) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a readable image')); };
    img.src = url;
  });
}

/** Strip extension, punctuation and case so "Ravi_Kumar.JPG" ≈ "ravi kumar". */
export function normalizeKey(s) {
  return String(s || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Build { normalizedFileName -> dataURL } from a FileList. */
export async function buildPhotoIndex(files, onProgress) {
  const index = new Map();
  const list = [...files].filter(f => /^image\//.test(f.type));
  let done = 0;
  for (const f of list) {
    try {
      index.set(normalizeKey(f.name), await resizeToDataURL(f));
    } catch { /* skip unreadable files */ }
    onProgress?.(++done, list.length);
  }
  return index;
}

/**
 * Find a player's photo. Tries, in order: the value in the photo column
 * (as a file name), the lot/id, then the player's name.
 */
export function lookupPhoto(index, { photoValue, id, name }) {
  for (const candidate of [photoValue, id, name]) {
    if (!candidate) continue;
    const hit = index.get(normalizeKey(candidate));
    if (hit) return hit;
  }
  return null;
}

export const isUrl = v => /^(https?:)?\/\//i.test(String(v || '').trim()) || /^data:image\//i.test(String(v || ''));

/** Try to inline a remote image so the shared file works offline. May fail on CORS. */
export async function inlineRemote(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return resizeToDataURL(await res.blob());
}
