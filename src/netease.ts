// NetEase Cloud Music weapi crypto + playlist fetching
// Self-contained ~60 lines using Web Crypto API + big-integer for RSA

import bigInt from 'big-integer';

// ---- Constants (well-known from NetEase web client) ----
const MODULUS = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
const PUBKEY = '010001';
const NONCE = '0CoJUm6Qyw8W8jud';  // Fixed first AES key
const IV = '0102030405060708';     // Fixed IV
// User-Agent for NetEase API requests
// Update periodically if NetEase starts rejecting outdated browser fingerprints
const NETEASE_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Referer: 'https://music.163.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

// ---- Helpers ----

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = '';
  for (let i = 0; i < length; i++) result += chars[bytes[i] % chars.length];
  return result;
}

function pkcs7Pad(data: Uint8Array, blockSize: number): Uint8Array {
  const padding = blockSize - (data.length % blockSize);
  const result = new Uint8Array(data.length + padding);
  result.set(data);
  result.fill(padding, data.length);
  return result;
}

async function aesCbcEncrypt(plaintext: string, keyStr: string, ivStr: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(keyStr);
  const ivData = enc.encode(ivStr);
  const padded = pkcs7Pad(enc.encode(plaintext), 16);

  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-CBC' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ivData }, cryptoKey, padded);

  // Base64 encode (manual since we need standard base64 not base64url)
  const bytes = new Uint8Array(encrypted);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function rsaEncrypt(secKey: string): string {
  // Reverse the random key
  const reversed = secKey.split('').reverse().join('');
  // Convert to hex string
  let hexStr = '';
  for (let i = 0; i < reversed.length; i++) {
    hexStr += reversed.charCodeAt(i).toString(16).padStart(2, '0');
  }
  // Modular exponentiation: hexStr ^ PUBKEY mod MODULUS
  const result = bigInt(hexStr, 16).modPow(bigInt(PUBKEY, 16), bigInt(MODULUS, 16));
  return result.toString(16).padStart(256, '0');
}

// ---- Public API ----

export async function weapiEncrypt(object: Record<string, unknown>): Promise<{ params: string; encSecKey: string }> {
  const text = JSON.stringify(object);
  const secKey = randomString(16);

  // Double AES-CBC: first with fixed key, then with random key
  const encText1 = await aesCbcEncrypt(text, NONCE, IV);
  const encText2 = await aesCbcEncrypt(encText1, secKey, IV);

  const encSecKey = rsaEncrypt(secKey);

  return { params: encText2, encSecKey };
}

export interface PlaylistRawResponse {
  code: number;
  playlist?: {
    id: number;
    name: string;
    coverImgUrl: string;
    trackCount: number;
    trackIds?: Array<{ id: number }>;
    tracks: Array<{
      id: number;
      name: string;
      ar: Array<{ name: string }>;
      al: { name: string };
      dt: number;
    }>;
  };
}

interface SongDetailResponse {
  code: number;
  songs?: Array<{
    id: number;
    name: string;
    ar: Array<{ name: string }>;
    al: { name: string };
    dt: number;
  }>;
}

type PlaylistTrack = NonNullable<PlaylistRawResponse['playlist']>['tracks'][number];

function collectOrderedUniqueIds(idGroups: Array<Array<number | undefined> | undefined>): number[] {
  const orderedIds: number[] = [];
  const seen = new Set<number>();

  for (const group of idGroups) {
    for (const rawId of group || []) {
      if (!Number.isFinite(rawId)) continue;
      const id = Number(rawId);
      if (seen.has(id)) continue;
      seen.add(id);
      orderedIds.push(id);
    }
  }

  return orderedIds;
}

function extractTrackIdsFromHtml(html: string): number[] {
  const extractWithPattern = (pattern: RegExp): number[] => {
    const ids: number[] = [];
    const seen = new Set<number>();
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const id = Number.parseInt(match[1], 10);
      if (!Number.isFinite(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }

    return ids;
  };

  const anchorIds = extractWithPattern(/\/song\?id=(\d+)/g);
  if (anchorIds.length > 0) {
    return anchorIds;
  }

  return extractWithPattern(/"songId"\s*:\s*(\d+)/g);
}

async function fetchPlaylistPageTrackIds(playlistId: string, mobile = false): Promise<number[]> {
  const pageUrl = mobile
    ? `https://music.163.com/m/playlist?id=${encodeURIComponent(playlistId)}`
    : `https://music.163.com/playlist?id=${encodeURIComponent(playlistId)}`;

  const res = await fetch(pageUrl, {
    headers: {
      Referer: 'https://music.163.com/',
      'User-Agent': NETEASE_HEADERS['User-Agent'],
    },
  });

  if (!res.ok) return [];
  const html = await res.text();
  return extractTrackIdsFromHtml(html);
}

async function fetchSongDetailsBatch(ids: number[]): Promise<PlaylistTrack[]> {
  if (!ids.length) return [];

  const encrypted = await weapiEncrypt({
    c: JSON.stringify(ids.map(id => ({ id }))),
    ids: JSON.stringify(ids),
    csrf_token: '',
  });

  const body = new URLSearchParams();
  body.set('params', encrypted.params);
  body.set('encSecKey', encrypted.encSecKey);

  const res = await fetch('https://music.163.com/weapi/v3/song/detail?csrf_token=', {
    method: 'POST',
    headers: NETEASE_HEADERS,
    body: body.toString(),
  });

  const data = await res.json() as SongDetailResponse;
  return data.code === 200 && data.songs ? data.songs : [];
}

export async function fetchPlaylistDetail(playlistId: string): Promise<PlaylistRawResponse> {
  const encrypted = await weapiEncrypt({
    id: playlistId,
    n: 100000,
    s: 8,
    csrf_token: '',
  });

  const body = new URLSearchParams();
  body.set('params', encrypted.params);
  body.set('encSecKey', encrypted.encSecKey);

  const res = await fetch('https://music.163.com/weapi/v6/playlist/detail?csrf_token=', {
    method: 'POST',
    headers: NETEASE_HEADERS,
    body: body.toString(),
  });

  return res.json() as Promise<PlaylistRawResponse>;
}

/** Fetch all track IDs for a large playlist, then batch-fetch song details */
export async function fetchAllTracks(playlistId: string): Promise<PlaylistRawResponse> {
  const encrypted = await weapiEncrypt({
    id: playlistId,
    n: 100000,
    s: 0,
    csrf_token: '',
  });

  const body = new URLSearchParams();
  body.set('params', encrypted.params);
  body.set('encSecKey', encrypted.encSecKey);

  const res = await fetch('https://music.163.com/weapi/v3/playlist/detail?csrf_token=', {
    method: 'POST',
    headers: NETEASE_HEADERS,
    body: body.toString(),
  });

  const data = await res.json() as PlaylistRawResponse;
  const playlist = data.playlist;
  if (data.code !== 200 || !playlist) return data;

  const apiTrackIds = (playlist.trackIds || [])
    .map(item => item?.id)
    .filter((id): id is number => Number.isFinite(id));
  const inlinedTrackIds = (playlist.tracks || [])
    .map(track => track?.id)
    .filter((id): id is number => Number.isFinite(id));
  const desktopPageTrackIds = await fetchPlaylistPageTrackIds(playlistId, false).catch(() => []);
  const mobilePageTrackIds = desktopPageTrackIds.length >= 20
    ? []
    : await fetchPlaylistPageTrackIds(playlistId, true).catch(() => []);
  const orderedIds = collectOrderedUniqueIds([
    desktopPageTrackIds,
    mobilePageTrackIds,
    apiTrackIds,
    inlinedTrackIds,
  ]);

  if (!orderedIds.length) return data;
  playlist.trackCount = Math.max(playlist.trackCount || 0, orderedIds.length, inlinedTrackIds.length);

  const existingById = new Map<number, PlaylistTrack>();
  for (const track of playlist.tracks || []) {
    existingById.set(track.id, track);
  }

  // If detail endpoint already returned the full track list, preserve it in playlist order.
  if ((playlist.tracks || []).length >= orderedIds.length) {
    playlist.tracks = orderedIds
      .map(id => existingById.get(id))
      .filter((track): track is PlaylistTrack => Boolean(track));
    return data;
  }

  const BATCH_SIZE = 500;
  const fetchedById = new Map<number, PlaylistTrack>();

  for (let i = 0; i < orderedIds.length; i += BATCH_SIZE) {
    const batchIds = orderedIds.slice(i, i + BATCH_SIZE);
    const songs = await fetchSongDetailsBatch(batchIds);
    for (const song of songs) {
      fetchedById.set(song.id, song);
    }
  }

  playlist.tracks = orderedIds
    .map(id => fetchedById.get(id) || existingById.get(id))
    .filter((track): track is PlaylistTrack => Boolean(track));

  return data;
}
