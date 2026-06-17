// Bilibili API wrapper: WBI signing, QR login, search, favorites
// All operations are server-side (no CORS issues)

import type { BilibiliMatchCandidate, BilibiliMatchDecision, BilibiliVideo, QRInitData, QRPollData } from './types';

// ---- WBI Signing ----

const MIXIN_KEY_ENC_TAB: number[] = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 44, 34, 52
];

function getMixinKey(combined: string): string {
  return MIXIN_KEY_ENC_TAB
    .filter(n => n < combined.length)
    .map(n => combined[n])
    .slice(0, 32)
    .join('');
}

/** MD5 hash (pure JS, ~500 bytes, works in Workers) */
function md5(input: string): string {
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    const add = (a: number, b: number) => { const lsw = (a & 0xffff) + (b & 0xffff); return (((a >>> 16) + (b >>> 16) + (lsw >>> 16)) << 16) | (lsw & 0xffff); };
    return add(((q + add(b, x)) >>> s), t);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number { return cmn(c ^ (b | (~d)), a, b, x, s, t); }

  const utf8Encode = (str: string): number[] => {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 128) bytes.push(c);
      else if (c < 2048) { bytes.push(192 | (c >>> 6)); bytes.push(128 | (c & 63)); }
      else { bytes.push(224 | (c >>> 12)); bytes.push(128 | ((c >>> 6) & 63)); bytes.push(128 | (c & 63)); }
    }
    return bytes;
  };

  const bytes = utf8Encode(input);
  const len = bytes.length;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const lo = len * 8;
  for (let i = 0; i < 4; i++) bytes.push((lo >>> (i * 8)) & 0xff);
  for (let i = 4; i < 8; i++) bytes.push(0);

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  for (let k = 0; k < bytes.length; k += 64) {
    const m: number[] = [];
    for (let i = 0; i < 16; i++) m[i] = bytes[k + i * 4] | (bytes[k + i * 4 + 1] << 8) | (bytes[k + i * 4 + 2] << 16) | (bytes[k + i * 4 + 3] << 24);
    let aa = a, bb = b, cc = c, dd = d;
    a = ff(a, b, c, d, m[0], 7, 0xd76aa478); d = ff(d, a, b, c, m[1], 12, 0xe8c7b756); c = ff(c, d, a, b, m[2], 17, 0x242070db); b = ff(b, c, d, a, m[3], 22, 0xc1bdceee);
    a = ff(a, b, c, d, m[4], 7, 0xf57c0faf); d = ff(d, a, b, c, m[5], 12, 0x4787c62a); c = ff(c, d, a, b, m[6], 17, 0xa8304613); b = ff(b, c, d, a, m[7], 22, 0xfd469501);
    a = ff(a, b, c, d, m[8], 7, 0x698098d8); d = ff(d, a, b, c, m[9], 12, 0x8b44f7af); c = ff(c, d, a, b, m[10], 17, 0xffff5bb1); b = ff(b, c, d, a, m[11], 22, 0x895cd7be);
    a = ff(a, b, c, d, m[12], 7, 0x6b901122); d = ff(d, a, b, c, m[13], 12, 0xfd987193); c = ff(c, d, a, b, m[14], 17, 0xa679438e); b = ff(b, c, d, a, m[15], 22, 0x49b40821);
    a = gg(a, b, c, d, m[1], 5, 0xf61e2562); d = gg(d, a, b, c, m[6], 9, 0xc040b340); c = gg(c, d, a, b, m[11], 14, 0x265e5a51); b = gg(b, c, d, a, m[0], 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, m[5], 5, 0xd62f105d); d = gg(d, a, b, c, m[10], 9, 0x2441453); c = gg(c, d, a, b, m[15], 14, 0xd8a1e681); b = gg(b, c, d, a, m[4], 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, m[9], 5, 0x21e1cde6); d = gg(d, a, b, c, m[14], 9, 0xc33707d6); c = gg(c, d, a, b, m[3], 14, 0xf4d50d87); b = gg(b, c, d, a, m[8], 20, 0x455a14ed);
    a = gg(a, b, c, d, m[13], 5, 0xa9e3e905); d = gg(d, a, b, c, m[2], 9, 0xfcefa3f8); c = gg(c, d, a, b, m[7], 14, 0x676f02d9); b = gg(b, c, d, a, m[12], 20, 0x8d2a4c8a);
    a = hh(a, b, c, d, m[5], 4, 0xfffa3942); d = hh(d, a, b, c, m[8], 11, 0x8771f681); c = hh(c, d, a, b, m[11], 16, 0x6d9d6122); b = hh(b, c, d, a, m[14], 23, 0xfde5380c);
    a = hh(a, b, c, d, m[1], 4, 0xa4beea44); d = hh(d, a, b, c, m[4], 11, 0x4bdecfa9); c = hh(c, d, a, b, m[7], 16, 0xf6bb4b60); b = hh(b, c, d, a, m[10], 23, 0xbebfbc70);
    a = hh(a, b, c, d, m[13], 4, 0x289b7ec6); d = hh(d, a, b, c, m[0], 11, 0xeaa127fa); c = hh(c, d, a, b, m[3], 16, 0xd4ef3085); b = hh(b, c, d, a, m[6], 23, 0x4881d05);
    a = hh(a, b, c, d, m[9], 4, 0xd9d4d039); d = hh(d, a, b, c, m[12], 11, 0xe6db99e5); c = hh(c, d, a, b, m[15], 16, 0x1fa27cf8); b = hh(b, c, d, a, m[2], 23, 0xc4ac5665);
    a = ii(a, b, c, d, m[0], 6, 0xf4292244); d = ii(d, a, b, c, m[7], 10, 0x432aff97); c = ii(c, d, a, b, m[14], 15, 0xab9423a7); b = ii(b, c, d, a, m[5], 21, 0xfc93a039);
    a = ii(a, b, c, d, m[12], 6, 0x655b59c3); d = ii(d, a, b, c, m[3], 10, 0x8f0ccc92); c = ii(c, d, a, b, m[10], 15, 0xffeff47d); b = ii(b, c, d, a, m[1], 21, 0x85845dd1);
    a = ii(a, b, c, d, m[8], 6, 0x6fa87e4f); d = ii(d, a, b, c, m[15], 10, 0xfe2ce6e0); c = ii(c, d, a, b, m[6], 15, 0xa3014314); b = ii(b, c, d, a, m[13], 21, 0x4e0811a1);
    a = ii(a, b, c, d, m[4], 6, 0xf7537e82); d = ii(d, a, b, c, m[11], 10, 0xbd3af235); c = ii(c, d, a, b, m[2], 15, 0x2ad7d2bb); b = ii(b, c, d, a, m[9], 21, 0xeb86d391);
    a = (a + aa) >>> 0; b = (b + bb) >>> 0; c = (c + cc) >>> 0; d = (d + dd) >>> 0;
  }
  const toHex = (n: number) => n.toString(16).padStart(8, '0');
  return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}

/** Bilibili-specific URL encoding (uppercase hex, %20 for spaces) */
function biliEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/%([0-9a-f]{2})/g, (_, hex) => '%' + hex.toUpperCase())
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

let cachedWbiKeys: { img_key: string; sub_key: string; expires: number } | null = null;

export async function getWbiKeys(): Promise<{ img_key: string; sub_key: string }> {
  if (cachedWbiKeys && cachedWbiKeys.expires > Date.now()) {
    return { img_key: cachedWbiKeys.img_key, sub_key: cachedWbiKeys.sub_key };
  }

  const res = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', Referer: 'https://www.bilibili.com/' },
  });
  const data = await res.json() as { data?: { wbi_img?: { img_url: string; sub_url: string } } };

  const wbi = data?.data?.wbi_img;
  if (!wbi) throw new Error('Failed to fetch WBI keys');

  const img_key = (wbi.img_url.split('/').pop() || '').split('.')[0];
  const sub_key = (wbi.sub_url.split('/').pop() || '').split('.')[0];

  cachedWbiKeys = { img_key, sub_key, expires: Date.now() + 3600_000 }; // cache 1 hour
  return { img_key, sub_key };
}

export function wbiSign(params: Record<string, string | number>, img_key: string, sub_key: string): Record<string, string | number> {
  const mixinKey = getMixinKey(img_key + sub_key);
  const wts = Math.floor(Date.now() / 1000);
  const allParams: Record<string, string> = {};

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) allParams[k] = String(v);
  }
  allParams.wts = String(wts);

  const sorted = Object.keys(allParams)
    .sort()
    .map(k => `${k}=${biliEncode(allParams[k])}`)
    .join('&');

  const w_rid = md5(sorted + mixinKey);

  return { ...params, wts, w_rid };
}

// ---- Common Bilibili fetch ----

const BILI_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BILI_REFERER = 'https://www.bilibili.com/';

function biliHeaders(cookie?: string): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': BILI_UA,
    Referer: BILI_REFERER,
    Origin: 'https://www.bilibili.com',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
  };
  if (cookie) h.Cookie = cookie;
  return h;
}

// ---- QR Login ----

export async function initQRLogin(): Promise<QRInitData> {
  const res = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
    headers: { ...biliHeaders(), Referer: 'https://passport.bilibili.com/' },
  });
  const data = await res.json() as { code: number; data?: { qrcode_key: string; url: string } };
  if (data.code !== 0 || !data.data) throw new Error('QR init failed: ' + JSON.stringify(data));
  return { qrcode_key: data.data.qrcode_key, url: data.data.url };
}

export async function pollQRLogin(qrcode_key: string): Promise<QRPollData> {
  const res = await fetch(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcode_key)}`, {
    headers: { ...biliHeaders(), Referer: 'https://passport.bilibili.com/' },
  });
  const data = await res.json() as { code: number; data?: { code: number; message: string; url?: string; refresh_token?: string } };
  const d = data.data;

  if (!d) return { status: 'failed', message: 'No response data' };

  // Bilibili QR poll codes:
  // 0: success, 86038: expired, 86090: scanned but not confirmed, 86101: not scanned
  if (d.code === 0) return { status: 'success' };
  if (d.code === 86038) return { status: 'expired' };
  if (d.code === 86090) return { status: 'scanned', message: 'Scanned, waiting for confirmation' };
  if (d.code === 86101) return { status: 'pending' };

  return { status: 'failed', message: d.message || `Unknown code: ${d.code}` };
}

/** Extract cookies from Set-Cookie headers after successful QR login */
export function extractCookies(setCookieHeaders: string[]): { sessdata: string; bili_jct: string; dedeuserid: string } | null {
  let sessdata = '', bili_jct = '', dedeuserid = '';
  for (const h of setCookieHeaders) {
    const parts = h.split(';')[0];
    if (parts.includes('SESSDATA=')) {
      const m = parts.match(/SESSDATA=([^;]+)/);
      if (m) sessdata = m[1];
    } else if (parts.includes('bili_jct=')) {
      const m = parts.match(/bili_jct=([^;]+)/);
      if (m) bili_jct = m[1];
    } else if (parts.includes('DedeUserID=')) {
      const m = parts.match(/DedeUserID=([^;]+)/);
      if (m) dedeuserid = m[1];
    }
  }
  if (!sessdata || !bili_jct) return null;
  return { sessdata, bili_jct, dedeuserid };
}

/** Poll AND extract cookies — use this to get cookies from successful login */
export async function pollQRLoginWithCookies(qrcode_key: string): Promise<QRPollData & { cookies?: { sessdata: string; bili_jct: string; dedeuserid: string } }> {
  const res = await fetch(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcode_key)}`, {
    headers: { ...biliHeaders(), Referer: 'https://passport.bilibili.com/' },
  });

  // getSetCookie() is available in Workers runtime but not in standard TS types
  const setCookieHeaders = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const data = await res.json() as { code: number; data?: { code: number; message: string; url?: string } };
  const d = data.data;

  if (!d) return { status: 'failed', message: 'No response data' };

  if (d.code === 0) {
    const cookies = extractCookies(setCookieHeaders);
    if (!cookies) {
      return { status: 'failed', message: 'Login succeeded but session cookies were not returned' };
    }
    return { status: 'success', cookies };
  }
  if (d.code === 86038) return { status: 'expired' };
  if (d.code === 86090) return { status: 'scanned', message: 'Scanned, waiting for confirmation' };
  if (d.code === 86101) return { status: 'pending' };
  return { status: 'failed', message: d.message || `Unknown code: ${d.code}` };
}

// ---- Search ----

interface BiliSearchResult {
  type: string;
  id: number;
  bvid: string;
  title: string;
  author: string;
  play: number;
  favorites?: number;
  review?: number;
  duration: string;
  pic: string;
  mid: number;
  description?: string;
  tag?: string;
  pubdate?: number;
}

interface BiliSearchResponse {
  code: number;
  message?: string;
  data?: {
    result?: BiliSearchResult[];
    numResults?: number;
    pageinfo?: { page: number; pagesize: number; numResults: number; totalPages: number };
  };
}

interface BiliOfficialVerify {
  type?: number;
  desc?: string;
  title?: string;
  role?: number;
}

interface BiliCardResponse {
  code: number;
  data?: {
    card?: {
      Official?: BiliOfficialVerify;
      official_verify?: BiliOfficialVerify;
    };
    Official?: BiliOfficialVerify;
    official_verify?: BiliOfficialVerify;
  };
}

const NOISE_TERMS_ZH = [
  '翻唱', '剪辑', '混剪', '现场', '教程', '教學', '伴奏', '串烧',
];

const NOISE_TERMS_EN = [
  'cover', 'mad', 'amv', 'live', 'concert', 'reaction', 'karaoke', 'dj', 'remix',
];

const HIGH_NOISE_TERMS = new Set(['剪辑', '混剪', 'mad', 'amv', 'reaction', '教程', '教學']);

const MUSIC_BONUS_TERMS = [
  'mv', '歌词', '歌詞', '官方', '完整版', '单曲', '單曲', '音频', 'audio',
];

const officialVerifyCache = new Map<number, Promise<BilibiliVideo['officialVerify'] | undefined>>();

function stripSearchMarkup(title: string): string {
  return title
    .replace(/<em class="keyword">|<\/em>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[【】\[\]()（）"'`‘’“”\-_,.:;!?/\\|$]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueValues(values: string[]): string[] {
  return values.filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(' ')
    .map(s => s.trim())
    .filter(s => s.length >= 2);
}

function sanitizeSearchText(input: string): string {
  return input
    .replace(/[【】\[\]{}]/g, ' ')
    .replace(/[（）()]/g, ' ')
    .replace(/[·•]/g, ' ')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripVersionDecorators(input: string): string {
  let value = input;
  value = value.replace(/\((feat|ft|prod|remix|mix|ver|version|live)[^)]*\)/ig, ' ');
  value = value.replace(/（(feat|ft|prod|remix|mix|ver|version|live)[^）]*）/ig, ' ');
  value = value.replace(/\b(feat|ft)\.?\s+[^-()/]+/ig, ' ');
  // 仅在 - 后面是已知版本/混音标记时才删除
  value = value.replace(/\s+-\s+(live|remix|acoustic|instrumental|karaoke|original\s+mix|extended\s+mix|radio\s+edit|acapella|demo|club\s+mix|deluxe|remaster|remastered|混音版|现场版|原版|专辑版|纯净版|伴奏版)\b.*$/ig, ' ');
  value = value.replace(/\s+-\s+(live|remix|acoustic|instrumental|karaoke|original\s+mix|extended\s+mix|radio\s+edit|acapella|demo|club\s+mix|deluxe|remaster|remastered|混音版|现场版|原版|专辑版|纯净版|伴奏版)$/ig, ' ');
  return sanitizeSearchText(value);
}

function getPrimaryArtist(artists: string): string {
  return sanitizeSearchText(
    artists
      .split(/[\/、,&|]/)[0]
      ?.replace(/\b(feat|ft)\.?.*$/ig, '') || '',
  );
}

function buildSearchQueries(name: string, artists: string): string[] {
  const baseName = sanitizeSearchText(name);
  const strippedName = stripVersionDecorators(name);
  const primaryArtist = getPrimaryArtist(artists);
  const fullArtists = sanitizeSearchText(artists);
  const hasVersionDecorators = strippedName && strippedName !== baseName;
  const candidates = hasVersionDecorators
    ? [
        [strippedName, primaryArtist].filter(Boolean).join(' ').trim(),
        strippedName,
        [baseName, primaryArtist].filter(Boolean).join(' ').trim(),
        [baseName, fullArtists].filter(Boolean).join(' ').trim(),
        baseName,
      ]
    : [
        [baseName, fullArtists].filter(Boolean).join(' ').trim(),
        [baseName, primaryArtist].filter(Boolean).join(' ').trim(),
        baseName,
      ];

  return uniqueValues(candidates);
}

function getTrackNameVariants(trackName: string): string[] {
  return uniqueValues([
    sanitizeSearchText(trackName),
    stripVersionDecorators(trackName),
  ]);
}

function getTitleTokens(trackName: string): string[] {
  const ignored = new Set(['feat', 'ft', 'prod', 'remix', 'mix', 'ver', 'version', 'live']);
  return uniqueValues(
    getTrackNameVariants(trackName)
      .flatMap(value => tokenize(value))
      .filter(token => !ignored.has(token)),
  );
}

function getArtistTokens(artists: string): string[] {
  return uniqueValues([
    ...tokenize(artists),
    ...tokenize(getPrimaryArtist(artists)),
  ]);
}

function parseDurationToSeconds(duration: string): number | null {
  if (!duration) return null;
  const parts = duration.split(':').map(n => Number.parseInt(n, 10));
  if (parts.some(n => Number.isNaN(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function toCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeOfficialVerify(official?: BiliOfficialVerify): BilibiliVideo['officialVerify'] | undefined {
  if (!official) return undefined;
  const rawType = typeof official.type === 'number' ? official.type : null;
  const isVerified = rawType !== null ? rawType >= 0 : Boolean((official.title || official.desc || '').trim());
  if (!isVerified) return undefined;

  return {
    isVerified: true,
    isInstitution: rawType === 1,
    title: official.title || '',
    desc: official.desc || '',
    type: rawType,
  };
}

async function fetchOfficialVerify(mid: number, cookies?: string): Promise<BilibiliVideo['officialVerify'] | undefined> {
  if (!Number.isFinite(mid) || mid <= 0) return undefined;

  const cached = officialVerifyCache.get(mid);
  if (cached) return cached;

  const pending = (async () => {
    let cookieStr = cookies || '';
    if (cookieStr && !cookieStr.includes('buvid3')) {
      cookieStr += '; buvid3=auto';
    }

    const res = await fetch(`https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(String(mid))}`, {
      headers: biliHeaders(cookieStr || undefined),
    });
    const data = await res.json() as BiliCardResponse;
    if (data.code !== 0) return undefined;

    return normalizeOfficialVerify(
      data.data?.card?.Official ||
      data.data?.card?.official_verify ||
      data.data?.Official ||
      data.data?.official_verify,
    );
  })().catch(() => undefined);

  officialVerifyCache.set(mid, pending);
  return pending;
}

async function enrichOfficialVerify(candidate: BilibiliVideo, cookies?: string): Promise<BilibiliVideo> {
  if (!candidate.mid) return candidate;
  const officialVerify = await fetchOfficialVerify(candidate.mid, cookies);
  if (!officialVerify) return candidate;
  return {
    ...candidate,
    officialVerify,
  };
}

function scoreOfficialUpload(candidate: BilibiliVideo): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const official = candidate.officialVerify;
  if (!official?.isVerified) return { score: 0, reasons };

  if (official.isInstitution) {
    score += 28;
    reasons.push('账号是B站机构认证');
  } else {
    score += 16;
    reasons.push('账号有B站官方认证');
  }

  if (official.title) {
    reasons.push(`认证头衔: ${official.title}`);
  }

  return {
    score: Math.min(36, score),
    reasons,
  };
}

async function fetchSearchResults(keyword: string, cookies?: string, pageSize = 20): Promise<BilibiliVideo[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let cookieStr = cookies || '';
      if (!cookieStr.includes('buvid3')) {
        cookieStr += '; buvid3=auto';
      }

      const wbiKeys = await getWbiKeys();
      const signed = wbiSign({ search_type: 'video', keyword, order: 'totalrank', page: 1, page_size: pageSize }, wbiKeys.img_key, wbiKeys.sub_key);
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(signed)) qs.set(k, String(v));

      const res = await fetch(`https://api.bilibili.com/x/web-interface/wbi/search/type?${qs.toString()}`, {
        headers: biliHeaders(cookieStr),
      });
      if (!res.ok) throw new Error(`B站搜索 HTTP ${res.status}`);

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`B站搜索返回非 JSON 响应: ${contentType || 'unknown'}`);
      }

      const data = await res.json() as BiliSearchResponse;
      if (data.code !== 0) {
        throw new Error(`B站搜索接口返回 ${data.code}${data.message ? `: ${data.message}` : ''}`);
      }

      if (!data.data?.result || data.data.result.length === 0) return [];

      return data.data.result.map(item => ({
        bvid: item.bvid,
        avid: item.id,
        mid: item.mid,
        title: stripSearchMarkup(item.title),
        author: item.author,
        play: toCount(item.play),
        favorites: toCount(item.favorites),
        review: toCount(item.review),
        duration: item.duration,
        pic: item.pic,
        pubdate: item.pubdate,
        description: item.description,
        tag: item.tag,
      }));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 0) {
        const backoffMs = lastError.message.includes('-412') ? 1800 : 350;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError || new Error('Bilibili search failed');
}

function scoreCandidate(candidate: BilibiliVideo, trackName: string, trackArtists: string, trackDurationMs?: number): BilibiliMatchCandidate {
  const normalizedTrackName = normalizeText(trackName);
  const normalizedTrackNameVariants = getTrackNameVariants(trackName)
    .map(value => normalizeText(value))
    .filter(value => value.length >= 2);
  const normalizedArtists = normalizeText(trackArtists);
  const normalizedTitle = normalizeText(candidate.title);
  const normalizedAuthor = normalizeText(candidate.author);
  const normalizedDescription = normalizeText(candidate.description || '');
  const normalizedTag = normalizeText(candidate.tag || '');
  const titleTokens = getTitleTokens(trackName);
  const artistTokens = getArtistTokens(trackArtists);
  const haystack = `${normalizedTitle} ${normalizedAuthor} ${normalizedDescription} ${normalizedTag}`;

  let relevanceScore = 0;
  let qualityScore = 0;
  const reasons: string[] = [];
  const noiseFlags: string[] = [];

  const matchedNameVariant = normalizedTrackNameVariants
    .sort((a, b) => b.length - a.length)
    .find(value => normalizedTitle.includes(value));
  if (matchedNameVariant) {
    relevanceScore += matchedNameVariant === normalizedTrackName ? 42 : 38;
    reasons.push(matchedNameVariant === normalizedTrackName ? '标题完整包含歌名' : '标题包含清洗后歌名');
  } else {
    // 新增：去空格后匹配（解决 B 站标题无空格的情况）
    const titleNoSpace = normalizedTitle.replace(/\s+/g, '');
    const matchedNoSpace = normalizedTrackNameVariants
      .sort((a, b) => b.length - a.length)
      .find(value => {
        const stripped = value.replace(/\s+/g, '');
        // 短歌名（<4字符）去空格后容易子串误匹配，跳过
        return stripped.length >= 4 && titleNoSpace.includes(stripped);
      });
    
    if (matchedNoSpace) {
      relevanceScore += 36;
      reasons.push('标题去空格后包含歌名');
    } else {
      const matchedTitleTokens = titleTokens.filter(token => {
        if (token.length >= 3 || /[^\x00-\x7f]/.test(token)) {
          return normalizedTitle.includes(token);
        }
        // 短英文 token 使用词边界匹配
        return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normalizedTitle);
      });
      if (matchedTitleTokens.length > 0) {
        relevanceScore += Math.min(36, matchedTitleTokens.length * 12);
        reasons.push(`标题命中关键词 ${matchedTitleTokens.length} 个`);
      }
    }
  }

  if (normalizedArtists) {
    const matchedArtistTokens = artistTokens.filter(token => {
      const searchIn = `${normalizedTitle} ${normalizedAuthor}`;
      if (token.length >= 3 || /[^\x00-\x7f]/.test(token)) {
        return searchIn.includes(token);
      }
      return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(searchIn);
    });
    if (matchedArtistTokens.length > 0) {
      relevanceScore += Math.min(26, matchedArtistTokens.length * 10);
      reasons.push(`艺人信息命中 ${matchedArtistTokens.length} 个`);
    }
    // 新增：完整艺人名匹配加分
    const primaryArtist = getPrimaryArtist(trackArtists);
    const normalizedPrimaryArtist = normalizeText(primaryArtist);
    if (normalizedPrimaryArtist && normalizedPrimaryArtist.length >= 2) {
      const searchIn = `${normalizedTitle} ${normalizedAuthor}`;
      if (searchIn.includes(normalizedPrimaryArtist)) {
        relevanceScore += 6;
        reasons.push('标题或作者包含主艺人名');
      }
    }
  }

  const candidateDurationSeconds = parseDurationToSeconds(candidate.duration);
  let durationDiffSeconds: number | null = null;
  if (trackDurationMs && candidateDurationSeconds !== null) {
    const trackDurationSeconds = Math.round(trackDurationMs / 1000);
    durationDiffSeconds = Math.abs(trackDurationSeconds - candidateDurationSeconds);
    if (durationDiffSeconds <= 5) {
      relevanceScore += 24;
      reasons.push('时长高度接近');
    } else if (durationDiffSeconds <= 12) {
      relevanceScore += 18;
      reasons.push('时长较接近');
    } else if (durationDiffSeconds <= 25) {
      relevanceScore += 10;
      reasons.push('时长基本可接受');
    } else if (durationDiffSeconds >= 90) {
      relevanceScore -= 14;
      noiseFlags.push('时长差异很大');
    } else if (durationDiffSeconds >= 45) {
      relevanceScore -= 6;
      noiseFlags.push('时长差异偏大');
    }
  }

  // 噪声检测仅在标题和作者名中进行，描述/标签中的噪声词不扣分
  const noiseHaystack = `${normalizedTitle} ${normalizedAuthor}`;

  for (const term of NOISE_TERMS_ZH) {
    if (noiseHaystack.includes(term)) {
      const penalty = HIGH_NOISE_TERMS.has(term) ? 16 : 10;
      relevanceScore -= penalty;
      noiseFlags.push(term);
    }
  }

  for (const term of NOISE_TERMS_EN) {
    // 英文噪声词使用词边界匹配，避免子串误命中（如 live 匹配 alive）
    const pattern = new RegExp(`\\b${term}\\b`, 'i');
    if (pattern.test(noiseHaystack)) {
      const penalty = HIGH_NOISE_TERMS.has(term) ? 16 : 10;
      relevanceScore -= penalty;
      noiseFlags.push(term);
    }
  }

  const musicBonusHits = MUSIC_BONUS_TERMS.filter(term => normalizedTitle.includes(term));
  if (musicBonusHits.length > 0) {
    relevanceScore += Math.min(10, musicBonusHits.length * 4);
    reasons.push('标题包含音乐向标记');
  }

  if (normalizedTitle.includes('原曲') || normalizedTitle.includes('官方')) {
    relevanceScore += 4;
  }

  const officialUpload = scoreOfficialUpload(candidate);
  if (officialUpload.score > 0) {
    qualityScore += officialUpload.score;
    reasons.push(`官方上传加分 ${officialUpload.score}`);
    reasons.push(...officialUpload.reasons);
  }

  const playCount = Math.max(0, candidate.play || 0);
  const favoriteCount = Math.max(0, candidate.favorites || 0);
  const reviewCount = Math.max(0, candidate.review || 0);
  const favoriteRate = playCount > 0 ? favoriteCount / playCount : 0;
  const reviewRate = playCount > 0 ? reviewCount / playCount : 0;

  if (playCount >= 1_000_000) {
    qualityScore += 16;
    reasons.push('播放量很高');
  } else if (playCount >= 200_000) {
    qualityScore += 11;
    reasons.push('播放量较高');
  } else if (playCount >= 50_000) {
    qualityScore += 6;
  } else if (playCount < 1_000) {
    qualityScore -= 2;
  }

  if (favoriteRate >= 0.04) {
    qualityScore += 10;
    reasons.push('收藏率较高');
  } else if (favoriteRate >= 0.015) {
    qualityScore += 6;
  }

  if (reviewRate >= 0.015) {
    qualityScore += 6;
    reasons.push('互动率较高');
  } else if (reviewRate >= 0.006) {
    qualityScore += 3;
  }

  const qualityTerms = ['高音质', '无损', 'hi res', 'hi-res', '完整版', '官方', '修复', '纯享', '4k', '1080p'];
  const qualityHits = qualityTerms.filter(term => haystack.includes(normalizeText(term)));
  if (qualityHits.length > 0) {
    qualityScore += Math.min(12, qualityHits.length * 4);
    reasons.push('包含音质或完整版标记');
  }

  const fragmentTerms = ['片段', '截取', 'cut', 'demo', '预告'];
  const fragmentHits = fragmentTerms.filter(term => haystack.includes(normalizeText(term)));
  if (fragmentHits.length > 0) {
    qualityScore -= Math.min(10, fragmentHits.length * 4);
    noiseFlags.push(...fragmentHits);
  }

  if (candidate.pubdate) {
    const ageDays = Math.max(0, (Date.now() / 1000 - candidate.pubdate) / 86400);
    if (ageDays <= 365 * 2) {
      qualityScore += 2;
    } else if (ageDays >= 365 * 8) {
      qualityScore -= 1;
    }
  }

  relevanceScore = Math.max(0, Math.min(100, relevanceScore));
  qualityScore = Math.max(0, Math.min(100, qualityScore + 20));
  const finalScore = Math.round(relevanceScore * 0.75 + qualityScore * 0.25);

  return {
    ...candidate,
    relevanceScore,
    qualityScore,
    officialUploadScore: officialUpload.score,
    finalScore,
    durationDiffSeconds,
    reasons,
    noiseFlags,
  };
}

function sortCandidates(candidates: BilibiliMatchCandidate[]): BilibiliMatchCandidate[] {
  return candidates.sort((a, b) => {
    const relevanceGap = Math.abs(b.relevanceScore - a.relevanceScore);
    if (relevanceGap >= 6) return b.relevanceScore - a.relevanceScore;
    if (b.officialUploadScore !== a.officialUploadScore) return b.officialUploadScore - a.officialUploadScore;
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    return b.finalScore - a.finalScore;
  });
}

export async function searchVideo(name: string, artists: string, durationMs: number | undefined, cookies?: string): Promise<BilibiliMatchDecision> {
  const query = [name, artists].filter(Boolean).join(' ').trim();
  const queries = buildSearchQueries(name, artists);
  const merged = new Map<number, BilibiliVideo>();
  let hadSearchError = false;

  for (const currentQuery of queries) {
    let results: BilibiliVideo[] = [];
    try {
      results = await fetchSearchResults(currentQuery, cookies, 20);
    } catch {
      hadSearchError = true;
      continue;
    }
    if (!results.length) {
      continue;
    }
    for (const item of results) {
      if (!merged.has(item.avid)) merged.set(item.avid, item);
    }
    if (merged.size >= 15) break;
  }

  const preliminaryCandidates = sortCandidates(Array.from(merged.values())
    .map(candidate => scoreCandidate(candidate, name, artists, durationMs))
  ).slice(0, 5);

  const enrichedCandidates = await Promise.all(
    preliminaryCandidates.map(candidate => enrichOfficialVerify(candidate, cookies)),
  );

  const candidates = sortCandidates(enrichedCandidates
    .map(candidate => scoreCandidate(candidate, name, artists, durationMs)))
    .slice(0, 5);

  if (!candidates.length && hadSearchError) {
    throw new Error('B站搜索接口返回异常，可能触发了临时风控，请稍后重试');
  }

  if (!candidates.length) {
    return {
      mode: 'skip',
      reason: '没有找到可用候选结果',
      candidates: [],
      query,
    };
  }

  const [top, second] = candidates;
  const relevanceGap = second ? top.relevanceScore - second.relevanceScore : top.relevanceScore;
  const hasSevereNoise = top.noiseFlags.filter(f => HIGH_NOISE_TERMS.has(f)).length >= 2;
  const highRelevanceCandidates = candidates.filter(candidate => candidate.relevanceScore >= 60);
  const topAmongHighRelevance = highRelevanceCandidates[0];
  const secondAmongHighRelevance = highRelevanceCandidates[1];
  const qualityLeadWithinHighRelevance = topAmongHighRelevance && secondAmongHighRelevance
    ? topAmongHighRelevance.qualityScore - secondAmongHighRelevance.qualityScore
    : (topAmongHighRelevance?.qualityScore ?? 0);

  if (top.relevanceScore >= 62 && !hasSevereNoise && (relevanceGap >= 6 || qualityLeadWithinHighRelevance >= 6)) {
    return {
      mode: 'auto',
      reason: top.officialUploadScore > 0 && highRelevanceCandidates.length > 1
        ? '多个高相关候选中，当前结果带官方上传加分，自动优先采用'
        : qualityLeadWithinHighRelevance >= 6 && highRelevanceCandidates.length > 1
        ? '多个高相关候选中，当前版本质量更好，自动采用'
        : '相关性高且结果明确，自动采用',
      selected: topAmongHighRelevance || top,
      candidates,
      query,
    };
  }

  if (top.relevanceScore >= 36) {
    return {
      mode: 'review',
      reason: relevanceGap < 6
        ? '多个候选都像这首歌，需要你按版本质量再确认'
        : '相关性尚可，但自动选择风险偏高，建议人工确认',
      candidates,
      query,
    };
  }

  return {
    mode: 'skip',
    reason: '候选分数仍然偏低，已跳过避免误收藏',
    candidates,
    query,
  };
}

// ---- Favorites ----

export async function createFavoritesFolder(title: string, cookies: string): Promise<number> {
  const csrf = extractCsrf(cookies);
  const body = new URLSearchParams();
  body.set('title', title);
  body.set('privacy', '0');
  body.set('csrf', csrf);

  const res = await fetch('https://api.bilibili.com/x/v3/fav/folder/add', {
    method: 'POST',
    headers: { ...biliHeaders(cookies), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json() as { code: number; data?: { id: number }; message?: string };
  if (data.code !== 0 || !data.data?.id) throw new Error(`Failed to create folder: ${data.message || JSON.stringify(data)}`);
  return data.data.id;
}

export async function addVideoToFavorite(avid: number, mediaId: number, cookies: string): Promise<boolean> {
  const csrf = extractCsrf(cookies);
  const body = new URLSearchParams();
  body.set('rid', String(avid));
  body.set('type', '2');
  body.set('add_media_ids', String(mediaId));
  body.set('csrf', csrf);
  body.set('platform', 'web');

  const res = await fetch('https://api.bilibili.com/x/v3/fav/resource/deal', {
    method: 'POST',
    headers: { ...biliHeaders(cookies), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json() as { code: number; message?: string };
  return data.code === 0;
}

export async function getUserInfo(cookies: string): Promise<{ mid: number; uname: string; face: string } | null> {
  const res = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: biliHeaders(cookies),
  });
  const data = await res.json() as { code: number; data?: { mid: number; uname: string; face: string; isLogin: boolean } };
  if (data.code === 0 && data.data?.isLogin) {
    return { mid: data.data.mid, uname: data.data.uname, face: data.data.face };
  }
  return null;
}

// ---- Helpers ----

function extractCsrf(cookieStr: string): string {
  const m = cookieStr.match(/bili_jct=([^;]+)/);
  if (!m) throw new Error('CSRF token (bili_jct) not found in cookies');
  return m[1];
}

/** Build a full cookie string from session, adding buvid3 and bili_ticket */
export function buildCookieStr(cookies: { sessdata: string; bili_jct: string; dedeuserid: string; buvid3?: string; bili_ticket?: string }): string {
  const parts: string[] = [];
  if (cookies.sessdata) parts.push(`SESSDATA=${cookies.sessdata}`);
  if (cookies.bili_jct) parts.push(`bili_jct=${cookies.bili_jct}`);
  if (cookies.dedeuserid) parts.push(`DedeUserID=${cookies.dedeuserid}`);
  if (cookies.buvid3) parts.push(`buvid3=${cookies.buvid3}`);
  if (cookies.bili_ticket) parts.push(`bili_ticket=${cookies.bili_ticket}`);
  parts.push('buvid3=auto'); // fallback device id
  return parts.join('; ');
}
