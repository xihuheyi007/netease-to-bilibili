// Frontend HTML — single page three-step wizard
// Served by Worker, with CSRF token injected server-side

export const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>网易云歌单 → 哔哩哔哩收藏夹同步</title>
<style>
  :root {
    --accent: #ff5b36;
    --accent-strong: #ee4d28;
    --accent-soft: #fff3ef;
    --bg: #f5f3ef;
    --surface: #ffffff;
    --surface-muted: #faf8f5;
    --text: #171412;
    --text-secondary: #5e5650;
    --text-tertiary: #948b84;
    --border: rgba(23, 20, 18, 0.08);
    --success: #11805d;
    --warning: #c9891f;
    --error: #cf4a3a;
    --radius: 22px;
    --radius-sm: 14px;
    --shadow: 0 18px 44px rgba(31, 24, 19, 0.08);
    --shadow-sm: 0 8px 20px rgba(31, 24, 19, 0.06);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: "SF Pro Display", "Segoe UI Variable", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.66), rgba(255,255,255,0.66)),
      linear-gradient(180deg, #f4f1ec 0%, #f6f4f0 100%);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 16px 40px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    position: relative;
    overflow-x: hidden;
  }

  .container {
    width: 100%;
    max-width: 720px;
    position: relative;
    z-index: 1;
  }

  /* Header */
  .app-header {
    text-align: center;
    margin-bottom: 18px;
    padding: 8px 0 0;
  }

  .app-header h1 {
    font-size: clamp(1.9rem, 4vw, 2.6rem);
    font-weight: 800;
    line-height: 1.08;
    letter-spacing: -0.05em;
    margin-bottom: 8px;
  }

  .accent-text {
    color: var(--accent-strong);
  }

  /* Step Indicator */
  .step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
    padding: 16px 18px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
  }

  .step-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .step-circle {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.88rem;
    font-weight: 700;
    transition: all 0.35s ease;
  }

  .step-circle.inactive {
    background: rgba(92, 69, 52, 0.10);
    color: var(--text-tertiary);
  }

  .step-circle.active {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 0 0 5px rgba(255, 91, 54, 0.12);
  }

  .step-circle.completed {
    background: #ff8d72;
    color: #fff;
  }

  .step-label-text {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    font-weight: 500;
    transition: color 0.3s;
  }

  .step-node.active .step-label-text {
    color: var(--accent);
    font-weight: 600;
  }

  .step-node.completed .step-label-text {
    color: var(--text);
  }

  .step-connector {
    width: 64px;
    height: 3px;
    background: rgba(92, 69, 52, 0.10);
    margin: 0 8px;
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
    border-radius: 999px;
  }

  .step-connector::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 0%;
    background: var(--accent);
    transition: width 0.4s ease;
  }

  .step-connector.completed::after {
    width: 100%;
  }

  /* Cards */
  .card {
    background: var(--surface);
    border-radius: var(--radius);
    padding: 30px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    position: relative;
    overflow: hidden;
  }

  .card + .card {
    margin-top: 16px;
  }

  .card:not(.hidden):hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 48px rgba(31, 24, 19, 0.09);
  }

  .card-header {
    margin-bottom: 20px;
  }

  .card-title {
    font-size: 1.18rem;
    font-weight: 700;
    margin-bottom: 6px;
    letter-spacing: -0.02em;
  }

  .card-desc {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  /* Form elements */
  .input-group {
    margin-bottom: 16px;
  }

  .text-input {
    width: 100%;
    padding: 14px 16px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.98rem;
    outline: none;
    transition: all 0.22s ease;
    background: var(--surface-muted);
    color: var(--text);
    font-family: inherit;
  }

  .text-input:focus {
    border-color: rgba(255, 91, 54, 0.32);
    background: #fff;
    box-shadow: 0 0 0 4px rgba(255, 91, 54, 0.08);
  }

  .text-input::placeholder {
    color: var(--text-tertiary);
  }

  /* Buttons */
  .btn {
    cursor: pointer;
    border: none;
    border-radius: var(--radius-sm);
    padding: 14px 24px;
    font-size: 0.95rem;
    font-weight: 600;
    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    overflow: hidden;
  }

  .btn-primary {
    background: var(--text);
    color: #fff;
    width: 100%;
    box-shadow: none;
  }

  .btn-primary:hover {
    background: #25201d;
    transform: translateY(-1px);
    box-shadow: 0 12px 22px rgba(31, 24, 19, 0.12);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .btn-primary:disabled {
    background: rgba(92, 69, 52, 0.12);
    color: var(--text-tertiary);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-secondary {
    background: #fff;
    color: var(--text);
    border: 1px solid var(--border);
    width: 100%;
    box-shadow: 0 8px 18px rgba(79, 52, 37, 0.05);
  }

  .btn-secondary:hover {
    background: #fff;
    border-color: rgba(23, 20, 18, 0.16);
    transform: translateY(-1px);
  }

  /* QR */
  .qr-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0 4px;
  }

  .qr-frame {
    padding: 18px;
    background: var(--surface-muted);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
  }

  .qr-frame img {
    width: 200px;
    height: 200px;
    display: block;
    border-radius: 8px;
  }

  .qr-status {
    margin-top: 16px;
    font-size: 0.92rem;
    color: var(--text-secondary);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .qr-status.success {
    color: var(--success);
  }

  .qr-status .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-tertiary);
    animation: pulse 2s infinite;
  }

  .qr-status.success .status-dot {
    background: var(--success);
    animation: none;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Progress */
  .progress-section {
    margin: 22px 0 10px;
    padding: 16px 16px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-muted);
    border: 1px solid var(--border);
  }

  .progress-bar-bg {
    background: rgba(92, 69, 52, 0.08);
    border-radius: 100px;
    height: 8px;
    overflow: hidden;
    position: relative;
  }

  .progress-bar-fill {
    background: var(--accent);
    height: 100%;
    border-radius: 100px;
    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    width: 0%;
    position: relative;
  }

  .progress-bar-fill::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    width: 20px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3));
    border-radius: 100px;
  }

  .progress-stats {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 0.8rem;
    color: var(--text-tertiary);
  }

  /* Track list */
  .track-list {
    max-height: 420px;
    overflow-y: auto;
    margin-top: 16px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-muted);
  }

  .track-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 12px;
    transition: background 0.18s ease, transform 0.18s ease;
    border-bottom: 1px solid rgba(92, 69, 52, 0.08);
  }

  .track-item:last-child {
    border-bottom: none;
  }

  .track-item:hover {
    background: rgba(255, 91, 54, 0.035);
  }

  .track-status {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .track-status.pending {
    background: rgba(92, 69, 52, 0.08);
    color: var(--text-tertiary);
  }

  .track-status.synced {
    background: rgba(11, 159, 119, 0.12);
    color: var(--success);
  }

  .track-status.skipped {
    background: rgba(242, 157, 56, 0.14);
    color: var(--warning);
  }

  .track-status.failed {
    background: rgba(217, 77, 63, 0.12);
    color: var(--error);
  }

  .track-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .track-name {
    font-size: 0.9rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
  }

  .track-artist {
    font-size: 0.8rem;
    color: var(--text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track-meta {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    flex-shrink: 0;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
  }

  /* Summary */
  .summary {
    text-align: center;
    padding: 22px;
    background: var(--accent-soft);
    border-radius: var(--radius-sm);
    margin-top: 16px;
    border: 1px solid rgba(255, 91, 54, 0.10);
  }

  .summary-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
  }

  .summary-stats {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .summary-stats strong {
    color: var(--accent-strong);
  }

  /* Error */
  .error-msg {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--error);
    font-size: 0.85rem;
    margin-top: 12px;
    padding: 10px 12px;
    background: rgba(217, 77, 63, 0.08);
    border-radius: 8px;
    border: 1px solid rgba(217, 77, 63, 0.14);
  }

  /* User info */
  .user-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(255,255,255,0.72);
    border-radius: var(--radius-sm);
    margin-bottom: 16px;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .user-info img {
    border-radius: 50%;
    width: 36px;
    height: 36px;
    border: 2px solid var(--surface);
    box-shadow: var(--shadow-sm);
  }

  /* Playlist badge */
  .playlist-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(255, 241, 235, 0.86);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    color: var(--accent-strong);
    font-weight: 700;
    margin-bottom: 16px;
    border: 1px solid rgba(255, 107, 74, 0.12);
  }

  .review-panel {
    margin: 16px 0;
    padding: 16px;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(255, 91, 54, 0.12);
    background: #fff8f5;
  }

  .review-title {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .review-subtitle {
    font-size: 0.82rem;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .review-track {
    font-size: 0.85rem;
    color: var(--text);
    margin-bottom: 12px;
  }

  .review-candidates {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 12px;
  }

  .review-candidate {
    width: 100%;
    text-align: left;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: #fff;
    cursor: pointer;
    transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }

  .review-candidate:hover {
    border-color: rgba(230, 0, 38, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(0,0,0,0.06);
  }

  .review-candidate-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
  }

  .review-candidate-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text);
  }

  .review-score {
    flex-shrink: 0;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--accent-light);
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 700;
  }

  .review-meta,
  .review-reasons {
    font-size: 0.78rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  /* Step transitions */
  .step-card:not(.hidden) {
    animation: fadeIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(16px) scale(0.985); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Utilities */
  .hidden { display: none !important; }

  /* Scrollbar */
  .track-list::-webkit-scrollbar {
    width: 6px;
  }

  .track-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .track-list::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }

  /* Responsive */
  @media (max-width: 480px) {
    body { padding: 18px 12px 28px; }
    .app-header h1 { font-size: 1.6rem; }
    .card { padding: 22px 18px; border-radius: 20px; }
    .step-indicator { padding: 14px 12px; }
    .step-connector { width: 26px; }
    .qr-frame img { width: 160px; height: 160px; }
  }
</style>
</head>
<body>

<div class="container">
  <!-- Header -->
  <header class="app-header">
    <h1>网易云歌单 <span class="accent-text">→</span> 哔哩哔哩收藏夹</h1>
  </header>

  <!-- Step Indicator -->
  <div class="step-indicator" id="stepIndicator">
    <div class="step-node active" id="stepNode1">
      <div class="step-circle active">1</div>
      <span class="step-label-text">歌单</span>
    </div>
    <div class="step-connector" id="stepConn1"></div>
    <div class="step-node inactive" id="stepNode2">
      <div class="step-circle inactive">2</div>
      <span class="step-label-text">登录</span>
    </div>
    <div class="step-connector" id="stepConn2"></div>
    <div class="step-node inactive" id="stepNode3">
      <div class="step-circle inactive">3</div>
      <span class="step-label-text">同步</span>
    </div>
  </div>

  <!-- Step 1: Import Playlist -->
  <div class="card step-card" id="step1">
    <div class="card-header">
      <h2 class="card-title">导入歌单</h2>
      <p class="card-desc">粘贴歌单链接</p>
    </div>
    <div class="input-group">
      <input type="text" class="text-input" id="playlistUrl" placeholder="https://music.163.com/#/playlist?id=123456">
    </div>
    <button class="btn btn-primary" id="btnImport">解析歌单</button>
    <div class="error-msg hidden" id="step1Error"></div>
  </div>

  <!-- Step 2: Login Bilibili -->
  <div class="card step-card hidden" id="step2">
    <div class="card-header">
      <h2 class="card-title">登录哔哩哔哩</h2>
      <p class="card-desc">App 扫码登录</p>
    </div>
    <div class="user-info hidden" id="userInfo"></div>
    <div class="qr-container">
      <div class="qr-frame">
        <img id="qrImg" class="hidden" alt="扫码登录">
      </div>
      <div class="qr-status" id="qrStatus">
        <span class="status-dot"></span>
        <span>生成二维码中…</span>
      </div>
    </div>
    <button class="btn btn-secondary hidden" id="btnRelogin">重新登录</button>
  </div>

  <!-- Step 3: Sync -->
  <div class="card step-card hidden" id="step3">
    <div class="card-header">
      <h2 class="card-title">同步歌单</h2>
      <p class="card-desc">确认后开始同步</p>
    </div>
    <div class="playlist-badge" id="playlistInfo"></div>
    <button class="btn btn-primary" id="btnSync">开始同步</button>
    <div class="review-panel hidden" id="reviewPanel">
      <div class="review-title">确认匹配</div>
      <div class="review-subtitle" id="reviewReason"></div>
      <div class="review-track" id="reviewTrack"></div>
      <div class="review-candidates" id="reviewCandidates"></div>
      <button class="btn btn-secondary" id="btnReviewSkip">跳过这首</button>
    </div>
    <div class="progress-section hidden" id="progressWrap">
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" id="progressBar" style="width:0%"></div>
      </div>
      <div class="progress-stats">
        <span id="progressText">0%</span>
        <span id="progressCount">0 / 0</span>
      </div>
    </div>
    <div class="track-list" id="trackList"></div>
    <div class="summary hidden" id="summary"></div>
  </div>
</div>

<script>
const CSRF_TOKEN = '__CSRF_TOKEN__';

// ---- State ----
let playlistTracks = [];
let playlistName = '';
let bilibiliLoggedIn = false;
let syncFolderId = 0;
let pollTimer = 0;
let reviewResolver = null;

// ---- Helpers ----
function $(id) { return document.getElementById(id); }
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function updateStepIndicator(step) {
  for (let i = 1; i <= 3; i++) {
    const node = $('stepNode' + i);
    const circle = node.querySelector('.step-circle');
    const conn = $('stepConn' + i);

    if (i < step) {
      node.className = 'step-node completed';
      circle.className = 'step-circle completed';
      circle.textContent = '✓';
      if (conn) conn.className = 'step-connector completed';
    } else if (i === step) {
      node.className = 'step-node active';
      circle.className = 'step-circle active';
      circle.textContent = i;
      if (conn) conn.className = 'step-connector';
    } else {
      node.className = 'step-node inactive';
      circle.className = 'step-circle inactive';
      circle.textContent = i;
      if (conn) conn.className = 'step-connector';
    }
  }
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF_TOKEN }, credentials: 'same-origin' };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  return res.json();
}

function buildSearchUrl(track) {
  const params = new URLSearchParams();
  params.set('name', track.name);
  params.set('artists', track.artists);
  params.set('duration_ms', String(track.duration || 0));
  return '/api/bilibili/search?' + params.toString();
}

async function searchTrackWithRetry(track) {
  let lastResult = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(buildSearchUrl(track), { credentials: 'same-origin' });
    const result = await res.json();
    lastResult = result;
    const error = result.error || '';
    const shouldRetry = !result.success && (
      error.includes('-412') ||
      error.includes('风控') ||
      error.includes('请求太频繁') ||
      error.includes('搜索接口返回异常')
    );
    if (!shouldRetry) return result;
    if (attempt < 2) await sleep(4000 + attempt * 3000);
  }
  return lastResult;
}

function describeCandidate(candidate) {
  const reasonText = (candidate.reasons || []).join(' · ') || '标题与艺人存在部分匹配';
  const noiseText = candidate.noiseFlags && candidate.noiseFlags.length ? '；风险词: ' + candidate.noiseFlags.join(' / ') : '';
  const durationText = candidate.durationDiffSeconds === null ? '时长未知' : '时长差 ' + candidate.durationDiffSeconds + ' 秒';
  const officialText = candidate.officialUploadScore ? '官传 ' + candidate.officialUploadScore + ' · ' : '';
  return '匹配 ' + candidate.relevanceScore + ' · 质量 ' + candidate.qualityScore + ' · ' + officialText + reasonText + ' · ' + durationText + noiseText;
}

function formatCandidateQuality(candidate) {
  const segments = [];
  if (candidate.play) segments.push('播放 ' + Number(candidate.play).toLocaleString());
  if (candidate.favorites) segments.push('收藏 ' + Number(candidate.favorites).toLocaleString());
  if (candidate.review) segments.push('评论 ' + Number(candidate.review).toLocaleString());
  return segments.join(' · ');
}

function closeReviewPanel() {
  reviewResolver = null;
  hide($('reviewPanel'));
  $('reviewCandidates').innerHTML = '';
}

function requestManualReview(track, decision) {
  return new Promise(resolve => {
    reviewResolver = resolve;
    $('reviewReason').textContent = decision.reason;
    $('reviewTrack').textContent = track.name + ' · ' + track.artists + ' · ' + formatTrackDuration(track.duration);
    const container = $('reviewCandidates');
    container.innerHTML = '';

    for (const candidate of decision.candidates) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'review-candidate';
      button.innerHTML =
        '<div class="review-candidate-head">' +
          '<div class="review-candidate-title">' + escapeHtml(candidate.title) + '</div>' +
          '<div class="review-score">总分 ' + candidate.finalScore + (candidate.officialUploadScore ? ' · 官传 ' + candidate.officialUploadScore : '') + '</div>' +
        '</div>' +
        '<div class="review-meta">' + escapeHtml(candidate.author) + ' · ' + escapeHtml(candidate.duration) + (formatCandidateQuality(candidate) ? ' · ' + escapeHtml(formatCandidateQuality(candidate)) : '') + '</div>' +
        '<div class="review-reasons">' + escapeHtml(describeCandidate(candidate)) + '</div>';
      button.addEventListener('click', () => {
        const currentResolver = reviewResolver;
        closeReviewPanel();
        if (currentResolver) currentResolver(candidate);
      });
      container.appendChild(button);
    }

    show($('reviewPanel'));
  });
}

// ---- Step 1: Import ----
$('btnImport').addEventListener('click', async () => {
  const url = $('playlistUrl').value.trim();
  if (!url) return;
  $('btnImport').disabled = true;
  $('btnImport').textContent = '解析中…';
  hide($('step1Error'));
  try {
    const r = await api('POST', '/api/netease/playlist', { url });
    if (!r.success) { $('step1Error').textContent = r.error; show($('step1Error')); return; }
    playlistTracks = r.data.tracks;
    playlistName = r.data.name;
    $('playlistInfo').textContent = r.data.name + ' · ' + r.data.trackCount + ' 首';
    hide($('step1'));
    show($('step2'));
    updateStepIndicator(2);
    initQR();
  } catch(e) {
    $('step1Error').textContent = '网络错误: ' + e.message; show($('step1Error'));
  } finally {
    $('btnImport').disabled = false;
    $('btnImport').textContent = '解析歌单';
  }
});

// ---- Step 2: QR Login ----
async function initQR() {
  $('qrStatus').innerHTML = '<span class="status-dot"></span><span>生成二维码中…</span>';
  $('qrStatus').className = 'qr-status';
  try {
    const r = await api('POST', '/api/bilibili/qr/init');
    if (!r.success) { $('qrStatus').innerHTML = '<span class="status-dot"></span><span>' + escapeHtml(r.error) + '</span>'; return; }
    $('qrImg').src = '/api/bilibili/qr/image?t=' + Date.now();
    show($('qrImg'));
    $('qrStatus').innerHTML = '<span class="status-dot"></span><span>请用哔哩哔哩 App 扫码</span>';
    startPolling();
  } catch(e) {
    $('qrStatus').innerHTML = '<span class="status-dot"></span><span>初始化失败: ' + escapeHtml(e.message) + '</span>';
  }
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const r = await api('POST', '/api/bilibili/qr/poll');
      if (!r.success) {
        if ((r.error || '').includes('过期')) {
          clearInterval(pollTimer);
          $('qrStatus').innerHTML = '<span class="status-dot"></span><span>二维码已过期，点击重新登录</span>';
          show($('btnRelogin'));
        }
        return;
      }
      if (r.data.status === 'success') {
        clearInterval(pollTimer);
        $('qrStatus').innerHTML = '<span class="status-dot"></span><span>登录成功</span>';
        $('qrStatus').className = 'qr-status success';
        bilibiliLoggedIn = true;
        hide($('qrImg'));
        setTimeout(showStep3, 800);
      } else if (r.data.status === 'scanned') {
        $('qrStatus').innerHTML = '<span class="status-dot"></span><span>已扫描，请在手机上确认…</span>';
      } else if (r.data.status === 'expired') {
        clearInterval(pollTimer);
        $('qrStatus').innerHTML = '<span class="status-dot"></span><span>二维码已过期，点击重新登录</span>';
        show($('btnRelogin'));
      }
    } catch(e) { /* retry */ }
  }, 2000);
}

$('btnRelogin').addEventListener('click', () => {
  hide($('btnRelogin'));
  initQR();
});

$('btnReviewSkip').addEventListener('click', () => {
  const currentResolver = reviewResolver;
  closeReviewPanel();
  if (currentResolver) currentResolver(null);
});

// ---- Step 3: Sync ----
function showStep3() {
  hide($('step2'));
  show($('step3'));
  updateStepIndicator(3);
}

$('btnSync').addEventListener('click', async () => {
  if (!playlistTracks.length) return;
  $('btnSync').disabled = true;
  $('btnSync').textContent = '同步中…';
  show($('progressWrap'));
  updateProgress(0, 0);

  // Create favorites folder (Bilibili limit: 20 chars)
  const maxLen = 20;
  let folderTitle = playlistName;
  if (folderTitle.length > maxLen) {
    folderTitle = folderTitle.substring(0, maxLen - 1) + '…';
  }

  let folderId = 0;
  try {
    const fr = await api('POST', '/api/bilibili/folder', { title: folderTitle });
    if (!fr.success) {
      alert('创建收藏夹失败: ' + fr.error);
      hide($('progressWrap'));
      $('btnSync').disabled = false;
      $('btnSync').textContent = '开始同步';
      return;
    }
    folderId = fr.data.id;
  } catch(e) {
    alert('创建收藏夹失败: ' + e.message);
    hide($('progressWrap'));
    $('btnSync').disabled = false;
    $('btnSync').textContent = '开始同步';
    return;
  }

  // Search + add each track
  let synced = 0, skipped = 0, failed = 0;
  const trackList = $('trackList');
  trackList.innerHTML = '';
  let syncInterrupted = false;
  closeReviewPanel();

  for (let i = 0; i < playlistTracks.length; i++) {
    const t = playlistTracks[i];

    // Show pending
    const item = document.createElement('div');
    item.className = 'track-item';
    item.innerHTML = '<div class="track-status pending">⏳</div><div class="track-info"><div class="track-name">' + escapeHtml(t.name) + '</div><div class="track-artist">' + escapeHtml(t.artists) + '</div></div><div class="track-meta" id="meta-' + i + '">搜索中…</div>';
    trackList.appendChild(item);

    try {
      // Search
      const sr = await searchTrackWithRetry(t);
      if (!sr.success && (sr.error || '').includes('请先登录')) {
        syncInterrupted = true;
        alert('登录状态已失效，请重新登录哔哩哔哩后再继续同步');
        break;
      }
      if (!sr.success || !sr.data) {
        item.querySelector('.track-status').textContent = '❌';
        item.querySelector('.track-status').className = 'track-status failed';
        item.querySelector('#meta-' + i).textContent = sr.error || '搜索失败';
        failed++;
        updateProgress((i+1)/playlistTracks.length, i+1);
        continue;
      }

      const decision = sr.data;
      let video = decision.selected || null;

      if (decision.mode === 'skip') {
        item.querySelector('.track-status').textContent = '⚠';
        item.querySelector('.track-status').className = 'track-status skipped';
        item.querySelector('#meta-' + i).textContent = decision.reason;
        skipped++;
        updateProgress((i+1)/playlistTracks.length, i+1);
        continue;
      }

      if (decision.mode === 'review') {
        item.querySelector('.track-status').textContent = '🤔';
        item.querySelector('.track-status').className = 'track-status skipped';
        item.querySelector('#meta-' + i).textContent = '等待你确认…';
        video = await requestManualReview(t, decision);
        if (!video) {
          item.querySelector('.track-status').textContent = '⏭';
          item.querySelector('.track-status').className = 'track-status skipped';
          item.querySelector('#meta-' + i).textContent = '已人工跳过';
          skipped++;
          updateProgress((i+1)/playlistTracks.length, i+1);
          continue;
        }
      }

      if (!video) {
        item.querySelector('.track-status').textContent = '❌';
        item.querySelector('.track-status').className = 'track-status failed';
        item.querySelector('#meta-' + i).textContent = '没有可用匹配';
        failed++;
        updateProgress((i+1)/playlistTracks.length, i+1);
        continue;
      }

      // Add to folder
      const ar = await api('POST', '/api/bilibili/fav', { avid: video.avid, media_id: folderId });
      if (ar.success) {
        item.querySelector('.track-status').textContent = '✓';
        item.querySelector('.track-status').className = 'track-status synced';
        item.querySelector('.track-name').title = video.title;
        item.querySelector('#meta-' + i).textContent = (decision.mode === 'review' ? '人工确认 ' : '自动匹配 ') + '总分 ' + video.finalScore + (video.officialUploadScore ? ' · 官传优先' : '');
        synced++;
      } else {
        item.querySelector('.track-status').textContent = '⚠';
        item.querySelector('.track-status').className = 'track-status skipped';
        item.querySelector('#meta-' + i).textContent = '添加失败';
        skipped++;
      }
    } catch(e) {
      item.querySelector('.track-status').textContent = '❌';
      item.querySelector('.track-status').className = 'track-status failed';
      item.querySelector('#meta-' + i).textContent = '网络错误';
      failed++;
    }

    updateProgress((i+1)/playlistTracks.length, i+1);

    // Rate limit: wait 1-2s between searches
    if (i < playlistTracks.length - 1) await sleep(1000 + Math.random() * 1000);
  }

  if (syncInterrupted) {
    closeReviewPanel();
    hide($('progressWrap'));
    $('btnSync').disabled = false;
    $('btnSync').textContent = '开始同步';
    return;
  }

  // Summary
  closeReviewPanel();
  $('summary').innerHTML = '<div class="summary-title">同步完成</div><div class="summary-stats">成功 <strong>' + synced + '</strong> 首 · 跳过 <strong>' + skipped + '</strong> 首 · 失败 <strong>' + failed + '</strong> 首</div>';
  show($('summary'));
  $('btnSync').textContent = '同步完成';
});

function updateProgress(ratio, count) {
  $('progressBar').style.width = Math.round(ratio * 100) + '%';
  $('progressText').textContent = Math.round(ratio * 100) + '%';
  $('progressCount').textContent = count + ' / ' + playlistTracks.length;
}

function formatTrackDuration(durationMs) {
  if (!durationMs) return '';
  const seconds = Math.round(durationMs / 1000);
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
</script>
</body>
</html>`;
