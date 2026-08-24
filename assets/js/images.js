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
  if (!index.size) return null;

  for (const candidate of [photoValue, id, name]) {
    const key = normalizeKey(candidate);
    if (key && index.has(key)) return index.get(key);
  }

  // Google Forms saves uploads as "<Respondent Name> - IMG_2231.jpg", and
  // people label files "12 ravi kumar.jpg". Accept a file whose name starts
  // with the player's name or lot — but only when exactly one file does, so
  // an ambiguous match never puts the wrong face on a card.
  const only = prefix => {
    if (!prefix || prefix.length < 2) return null;
    const hits = [...index.keys()].filter(k => k === prefix || k.startsWith(prefix + ' '));
    return hits.length === 1 ? index.get(hits[0]) : null;
  };
  return only(normalizeKey(name)) || only(normalizeKey(id));
}

export const isUrl = v => /^(https?:)?\/\//i.test(String(v || '').trim()) || /^data:image\//i.test(String(v || ''));

/**
 * Google Forms file-upload questions write a Drive *page* link into the
 * response sheet — `drive.google.com/open?id=…`. That is a web page, not an
 * image: dropped into an <img> it silently fails. Rewrite the known Drive
 * shapes to the host that actually serves the bytes.
 *
 * The file still has to be readable by whoever opens the booklet — Forms
 * uploads are private to the form owner until the folder is shared.
 */
export function normalizeImageUrl(value) {
  const url = String(value || '').trim();
  const id =
    url.match(/\/file\/d\/([-\w]{20,})/)?.[1] ||
    url.match(/[?&]id=([-\w]{20,})/)?.[1] ||
    (/drive\.google\.com|docs\.google\.com/.test(url) ? url.match(/([-\w]{25,})/)?.[1] : null);

  if (!id) return url;
  // lh3 serves the file directly and takes a size hint; =w800 keeps prints sharp.
  return `https://lh3.googleusercontent.com/d/${id}=w800`;
}

/** Try to inline a remote image so the shared file works offline. May fail on CORS. */
export async function inlineRemote(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return resizeToDataURL(await res.blob());
}
