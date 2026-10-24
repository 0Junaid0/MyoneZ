import { apiClient } from './client';

/** Uploads a picture picked on the phone. Remote URLs are already saved, so they are returned as-is. */
export async function uploadPhoto(path: string, uri: string): Promise<string | null> {
  if (!uri || uri.startsWith('http://') || uri.startsWith('https://')) return uri || null;
  const clean = uri.split('?')[0] ?? uri;
  const filename = clean.split('/').pop() || 'photo.jpg';
  const lower = filename.toLowerCase();
  const type = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const body = new FormData();
  body.append('photo', {
    uri,
    name: filename.includes('.') ? filename : 'photo.jpg',
    type,
  } as unknown as Blob);
  const res = await apiClient.patch<{ photo: string | null }>(path, body);
  return res.data.photo ?? null;
}
