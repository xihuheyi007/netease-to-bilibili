// Cloudflare Worker entry point — Hono router with CSRF, CORS, rate limiting

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import QRCode from 'qrcode';
import { fetchPlaylistDetail, fetchAllTracks } from './netease';
import { initQRLogin, pollQRLoginWithCookies, searchVideo, createFavoritesFolder, addVideoToFavorite, getUserInfo, buildCookieStr } from './bilibili';
import { ensureSession, requireSession, saveSession, attachBilibiliSession, destroySession, sessionCookieValue, clearSessionCookieValue } from './session';
import { FRONTEND_HTML } from './frontend';
import type { ApiResponse, NeteaseTrack, BilibiliVideo, BilibiliCookies, SessionData } from './types';

// ---- Env bindings ----
export interface Env {
  SESSIONS: KVNamespace;
}

type AppVars = {
  session: SessionData;
  sessionId: string;
};

const app = new Hono<{ Bindings: Env; Variables: AppVars }>();

app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('Referrer-Policy', 'same-origin');
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  c.res.headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
});

// ---- Rate limiting (simple in-memory, resets on cold start) ----
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function isLocalRequest(ip: string): boolean {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
  // 172.16.0.0/12 covers 172.16.x.x – 172.31.x.x
  if (ip.startsWith('172.')) {
    const second = Number.parseInt(ip.split('.')[1], 10);
    if (Number.isFinite(second) && second >= 16 && second <= 31) return true;
  }
  return false;
}

function rateLimit(ip: string, limit = 10, windowMs = 60_000): boolean {
  // Skip rate limiting for local requests
  if (isLocalRequest(ip)) return true;
  const key = ip;
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ---- CSRF Middleware for POST routes ----
async function csrfMiddleware(c: any, next: any) {
  if (c.req.method === 'POST') {
    const origin = c.req.header('Origin');
    const requestOrigin = new URL(c.req.url).origin;
    if (!origin || origin !== requestOrigin) {
      throw new HTTPException(403, { message: 'Cross-origin requests are not allowed' });
    }

    const requiredSession = await requireSession(c.env.SESSIONS, c.req.header('Cookie') || '');
    if (!requiredSession) {
      throw new HTTPException(401, { message: 'Session missing or expired' });
    }

    const csrfHeader = c.req.header('X-CSRF-Token');
    if (!csrfHeader || csrfHeader !== requiredSession.session.csrfToken) {
      throw new HTTPException(403, { message: 'CSRF validation failed' });
    }

    c.set('session', requiredSession.session);
    c.set('sessionId', requiredSession.sessionId);
  }
  await next();
}

// ---- Serve frontend ----
app.get('/', async (c) => {
  const { sessionId, session } = await ensureSession(c.env.SESSIONS, c.req.header('Cookie') || '');
  const html = FRONTEND_HTML.replace('__CSRF_TOKEN__', session.csrfToken);
  c.header('Set-Cookie', sessionCookieValue(sessionId));
  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.body(html);
});

app.get('/favicon.ico', (c) => c.body(null, 204));

// ---- Session check ----
app.get('/api/me', async (c) => {
  const requiredSession = await requireSession(c.env.SESSIONS, c.req.header('Cookie') || '');
  if (!requiredSession?.session.bilibili) return c.json<ApiResponse>({ success: false, error: 'Not logged in' });

  await saveSession(c.env.SESSIONS, requiredSession.sessionId, requiredSession.session);
  c.header('Set-Cookie', sessionCookieValue(requiredSession.sessionId));
  const cookieStr = buildCookieStr(requiredSession.session.bilibili);
  const user = await getUserInfo(cookieStr);
  return c.json<ApiResponse>({ success: true, data: user });
});

// ---- Step 1: Import NetEase playlist ----
app.post('/api/netease/playlist', csrfMiddleware, async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  if (!rateLimit(ip, 5, 60_000)) {
    return c.json<ApiResponse>({ success: false, error: '请求太频繁，请稍后再试' }, 429);
  }

  const { url } = await c.req.json<{ url: string }>();
  if (!url) return c.json<ApiResponse>({ success: false, error: '请提供网易云歌单链接' }, 400);

  // Parse playlist ID from URL
  const idMatch = url.match(/[?&#]id=(\d+)/) || url.match(/playlist\/(\d+)/);
  if (!idMatch) return c.json<ApiResponse>({ success: false, error: '无法解析歌单链接，请检查 URL' }, 400);
  const playlistId = idMatch[1];

  try {
    // Prefer the full-track path so public playlists do not stop at partial results.
    let data = await fetchAllTracks(playlistId);
    if (data.code !== 200 || !data.playlist) {
      data = await fetchPlaylistDetail(playlistId);
      if (data.code !== 200 || !data.playlist) {
        return c.json<ApiResponse>({ success: false, error: '获取歌单失败，请确认歌单为公开状态' }, 400);
      }
    }

    const pl = data.playlist;
    if (!pl) {
      return c.json<ApiResponse>({ success: false, error: '获取歌单失败，请确认歌单为公开状态' }, 400);
    }

    const tracks: NeteaseTrack[] = (pl.tracks || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      artists: (t.ar || []).map((a: any) => a.name).join(' / '),
      album: (t.al || {}).name || '',
      duration: t.dt || 0,
    }));

    return c.json<ApiResponse>({
      success: true,
      data: {
        id: pl.id,
        name: pl.name,
        coverUrl: pl.coverImgUrl,
        trackCount: pl.trackCount || tracks.length,
        tracks,
      },
    });
  } catch (e: any) {
    console.error('Playlist fetch failed:', e);
    return c.json<ApiResponse>({ success: false, error: '获取歌单失败，请稍后重试' }, 500);
  }
});

// ---- Step 2a: Init QR login ----
app.post('/api/bilibili/qr/init', csrfMiddleware, async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  if (!rateLimit(ip, 10, 60_000)) return c.json<ApiResponse>({ success: false, error: '请求太频繁' }, 429);

  try {
    const session = c.get('session');
    const sessionId = c.get('sessionId');
    const qr = await initQRLogin();
    session.pendingQr = {
      qrcodeKey: qr.qrcode_key,
      url: qr.url,
      createdAt: Date.now(),
    };
    await saveSession(c.env.SESSIONS, sessionId, session);
    c.header('Set-Cookie', sessionCookieValue(sessionId));
    return c.json<ApiResponse>({ success: true });
  } catch (e: any) {
    console.error('QR generation failed:', e);
    return c.json<ApiResponse>({ success: false, error: '生成二维码失败，请稍后重试' }, 500);
  }
});

// ---- Step 2a-alt: Generate QR code image (SVG) ----
app.get('/api/bilibili/qr/image', async (c) => {
  const requiredSession = await requireSession(c.env.SESSIONS, c.req.header('Cookie') || '');
  const pendingQr = requiredSession?.session.pendingQr;
  if (!requiredSession || !pendingQr) return c.json<ApiResponse>({ success: false, error: 'QR code expired, please refresh' }, 410);
  if (Date.now() - pendingQr.createdAt > 180_000) {
    requiredSession.session.pendingQr = undefined;
    await saveSession(c.env.SESSIONS, requiredSession.sessionId, requiredSession.session);
    return c.json<ApiResponse>({ success: false, error: 'QR code expired, please refresh' }, 410);
  }

  try {
    const svg = await QRCode.toString(pendingQr.url, {
      type: 'svg',
      width: 180,
      margin: 2,
      color: { dark: '#000', light: '#fff' },
    });
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('QR image generation failed:', e);
    return c.json<ApiResponse>({ success: false, error: '二维码生成失败，请刷新重试' }, 500);
  }
});

// ---- Step 2b: Poll QR login (session-bound, state-changing POST) ----
app.post('/api/bilibili/qr/poll', csrfMiddleware, async (c) => {
  const session = c.get('session');
  const sessionId = c.get('sessionId');
  const pendingQr = session.pendingQr;
  if (!pendingQr) return c.json<ApiResponse>({ success: false, error: '二维码会话不存在，请重新登录' }, 400);
  if (Date.now() - pendingQr.createdAt > 180_000) {
    session.pendingQr = undefined;
    await saveSession(c.env.SESSIONS, sessionId, session);
    return c.json<ApiResponse>({ success: false, error: '二维码已过期，请重新登录' }, 410);
  }

  try {
    const result = await pollQRLoginWithCookies(pendingQr.qrcodeKey);

    if (result.status === 'success' && result.cookies) {
      const biliCookies: BilibiliCookies = {
        sessdata: result.cookies.sessdata,
        bili_jct: result.cookies.bili_jct,
        dedeuserid: result.cookies.dedeuserid,
      };
      await attachBilibiliSession(c.env.SESSIONS, sessionId, session, biliCookies);
      c.header('Set-Cookie', sessionCookieValue(sessionId));
    } else if (result.status === 'expired' || result.status === 'failed') {
      session.pendingQr = undefined;
      await saveSession(c.env.SESSIONS, sessionId, session);
    }

    return c.json<ApiResponse>({ success: true, data: { status: result.status, message: result.message } });
  } catch (e: any) {
    console.error('QR poll failed:', e);
    return c.json<ApiResponse>({ success: false, error: '登录轮询失败，请稍后重试' }, 500);
  }
});

// ---- Step 2c: Logout ----
app.post('/api/bilibili/logout', csrfMiddleware, async (c) => {
  const cookieHeader = c.req.header('Cookie') || '';
  await destroySession(c.env.SESSIONS, cookieHeader);
  c.header('Set-Cookie', clearSessionCookieValue());
  return c.json<ApiResponse>({ success: true });
});

// ---- Step 3a: Search single song on Bilibili ----
app.get('/api/bilibili/search', async (c) => {
  const name = c.req.query('name')?.trim() || '';
  const artists = c.req.query('artists')?.trim() || '';
  const durationMsRaw = c.req.query('duration_ms');
  const keyword = c.req.query('q')?.trim() || '';
  const effectiveName = name || keyword;
  if (!effectiveName) return c.json<ApiResponse>({ success: false, error: 'Missing query' }, 400);
  const durationMs = durationMsRaw ? Number.parseInt(durationMsRaw, 10) : undefined;

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  if (!rateLimit(ip, 240, 60_000)) {
    return c.json<ApiResponse>({ success: false, error: '请求太频繁，请稍后再试' }, 429);
  }

  const requiredSession = await requireSession(c.env.SESSIONS, c.req.header('Cookie') || '');
  if (!requiredSession?.session.bilibili) {
    return c.json<ApiResponse>({ success: false, error: '请先登录哔哩哔哩' }, 401);
  }
  if (requiredSession) {
    await saveSession(c.env.SESSIONS, requiredSession.sessionId, requiredSession.session);
    c.header('Set-Cookie', sessionCookieValue(requiredSession.sessionId));
  }
  const cookieStr = buildCookieStr(requiredSession.session.bilibili);

  try {
    const result = await searchVideo(effectiveName, artists, durationMs, cookieStr);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (e: any) {
    console.error('Search failed:', e);
    return c.json<ApiResponse>({ success: false, error: '搜索失败，请稍后重试' }, 500);
  }
});

// ---- Step 3b: Create Bilibili favorites folder ----
app.post('/api/bilibili/folder', csrfMiddleware, async (c) => {
  const session = c.get('session');
  const sessionId = c.get('sessionId');
  if (!session?.bilibili) return c.json<ApiResponse>({ success: false, error: '请先登录哔哩哔哩' }, 401);

  const { title } = await c.req.json<{ title: string }>();
  if (!title) return c.json<ApiResponse>({ success: false, error: '请提供收藏夹名称' }, 400);

  try {
    const cookieStr = buildCookieStr(session.bilibili);
    const folderId = await createFavoritesFolder(title, cookieStr);
    await saveSession(c.env.SESSIONS, sessionId, session);
    c.header('Set-Cookie', sessionCookieValue(sessionId));
    return c.json<ApiResponse>({ success: true, data: { id: folderId } });
  } catch (e: any) {
    console.error('Folder creation failed:', e);
    return c.json<ApiResponse>({ success: false, error: '创建收藏夹失败，请稍后重试' }, 500);
  }
});

// ---- Step 3c: Add video to favorites ----
app.post('/api/bilibili/fav', csrfMiddleware, async (c) => {
  const session = c.get('session');
  const sessionId = c.get('sessionId');
  if (!session?.bilibili) return c.json<ApiResponse>({ success: false, error: '请先登录哔哩哔哩' }, 401);

  const { avid, media_id } = await c.req.json<{ avid: number; media_id: number }>();
  if (!avid || !media_id) return c.json<ApiResponse>({ success: false, error: 'Missing avid or media_id' }, 400);

  try {
    const cookieStr = buildCookieStr(session.bilibili);
    const ok = await addVideoToFavorite(avid, media_id, cookieStr);
    await saveSession(c.env.SESSIONS, sessionId, session);
    c.header('Set-Cookie', sessionCookieValue(sessionId));
    return c.json<ApiResponse>({ success: ok, error: ok ? undefined : '添加失败，可能该视频已存在或超出限制' });
  } catch (e: any) {
    console.error('Favorite add failed:', e);
    return c.json<ApiResponse>({ success: false, error: '添加收藏失败，请稍后重试' }, 500);
  }
});

// ---- Error handler ----
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json<ApiResponse>({ success: false, error: err.message }, err.status);
  }
  console.error('Unhandled error:', err);
  return c.json<ApiResponse>({ success: false, error: 'Internal server error' }, 500);
});

export default app;
