// Shared types for NetEase-to-Bilibili sync tool

/** Parsed from NetEase playlist */
export interface NeteaseTrack {
  id: number;
  name: string;
  artists: string;
  album: string;
  duration: number; // ms
}

export interface NeteasePlaylist {
  id: number;
  name: string;
  coverUrl: string;
  trackCount: number;
  tracks: NeteaseTrack[];
}

/** Bilibili search result */
export interface BilibiliVideo {
  bvid: string;
  avid: number;
  mid?: number;
  title: string;
  author: string;
  play: number;   // play count
  duration: string; // e.g. "04:30"
  pic: string;
  favorites?: number;
  review?: number;
  pubdate?: number;
  description?: string;
  tag?: string;
  officialVerify?: {
    isVerified: boolean;
    isInstitution: boolean;
    title?: string;
    desc?: string;
    type?: number | null;
  };
}

export interface BilibiliMatchCandidate extends BilibiliVideo {
  relevanceScore: number;
  qualityScore: number;
  officialUploadScore: number;
  finalScore: number;
  durationDiffSeconds: number | null;
  reasons: string[];
  noiseFlags: string[];
}

export interface BilibiliMatchDecision {
  mode: 'auto' | 'review' | 'skip';
  reason: string;
  selected?: BilibiliMatchCandidate;
  candidates: BilibiliMatchCandidate[];
  query: string;
}

/** Bilibili user session (stored in KV) */
export interface BilibiliCookies {
  sessdata: string;
  bili_jct: string;
  dedeuserid: string;
  buvid3?: string;
  bili_ticket?: string;
}

export interface PendingQrLogin {
  qrcodeKey: string;
  url: string;
  createdAt: number;
}

/** Full session data in KV */
export interface SessionData {
  bilibili?: BilibiliCookies;
  createdAt: number;
  lastAccessedAt: number;
  csrfToken: string;
  pendingQr?: PendingQrLogin;
}

/** Generic API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** QR login init */
export interface QRInitData {
  qrcode_key: string;
  url: string;
}

/** QR poll status */
export type QRStatus = 'pending' | 'scanned' | 'expired' | 'success' | 'failed';

export interface QRPollData {
  status: QRStatus;
  message?: string;
}

/** Sync progress tracking */
export interface SyncResult {
  total: number;
  synced: number;
  skipped: number;
  failed: number;
  tracks: SyncTrackResult[];
  folderId?: number;
  folderTitle?: string;
}

export interface SyncTrackResult {
  neteaseName: string;
  neteaseArtist: string;
  status: 'synced' | 'skipped' | 'failed';
  bilibiliBvid?: string;
  bilibiliTitle?: string;
}
