// 醉漢回家 — 傾斜手機讓醉漢保持平衡走回家
'use strict';
const VERSION = 'v0.1';
const AUTHOR = '作者：ArchieKUO';

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const LH = 600;               // 邏輯高度（所有尺寸以此為準）
let LW = 1280, SCALE = 1, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(innerWidth * DPR);
  cv.height = Math.round(innerHeight * DPR);
  SCALE = cv.height / LH;
  LW = cv.width / SCALE;
}
addEventListener('resize', resize);
resize();

// ---------- 素材 ----------
const N_WALK = 240, N_IDLE = 240;
const imgs = { walk: [], idle: [], street: null };
let loaded = 0;
const total = N_WALK + N_IDLE + 1;
function load(src) {
  const im = new Image();
  im.onload = im.onerror = () => { loaded++; };
  im.src = src;
  return im;
}
const pad = n => String(n).padStart(3, '0');
imgs.street = load('img/street.webp');
for (let i = 0; i < N_WALK; i++) imgs.walk.push(load(`img/walk/${pad(i)}.webp`));
for (let i = 0; i < N_IDLE; i++) imgs.idle.push(load(`img/idle/${pad(i)}.webp`));

// ---------- 紀錄 ----------
function getBest() { try { return +localStorage.getItem('dw_best') || 0; } catch (e) { return 0; } }
function setBest(v) { try { localStorage.setItem('dw_best', String(v)); } catch (e) {} }
let best = getBest();
let invert = false;
try { invert = localStorage.getItem('dw_invert') === '1'; } catch (e) {}

// ---------- 傾斜輸入 ----------
let tiltRaw = 0, tiltZero = 0, tiltOK = false;
let keyL = false, keyR = false, touchL = false, touchR = false;
function screenAngle() {
  if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  return window.orientation || 0;
}
addEventListener('devicemotion', e => {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x == null) return;
  tiltOK = true;
  // 橫拿時，左右傾斜對應裝置的 y 軸
  const a = screenAngle();
  let v;
  if (a === 90) v = -g.y;
  else if (a === 270 || a === -90) v = g.y;
  else if (a === 180) v = -g.x;
  else v = g.x;
  // 注意：Android 與 iOS 的正負號相反，這裡以 Android 為準
  tiltRaw = Math.max(-1, Math.min(1, -v / 9.8));
});
addEventListener('keydown', e => { if (e.key === 'ArrowLeft') keyL = true; if (e.key === 'ArrowRight') keyR = true; if (e.key === ' ' || e.key === 'Enter') { const b = buttons.find(b => b.id === 'start' || b.id === 'again'); if (b) tapAt(b.x + 1, b.y + 1); } });
addEventListener('keyup', e => { if (e.key === 'ArrowLeft') keyL = false; if (e.key === 'ArrowRight') keyR = false; });
function inputLean() {
  // 回傳 -1..1，正值＝往右推
  let v = 0;
  if (tiltOK) v += (tiltRaw - tiltZero) * 2.2 * (invert ? -1 : 1);
  if (keyL || touchL) v -= 1;
  if (keyR || touchR) v += 1;
  return Math.max(-1, Math.min(1, v));
}

// ---------- 狀態 ----------
let state = 'loading';     // loading | title | play | fall | result
let t0 = performance.now(), now = 0, last = 0;
let theta = 0, omega = 0;  // 傾斜角（弧度）、角速度
let dist = 0, playTime = 0, walkFrame = 0, idleFrame = 0;
let drift = 0, driftTarget = 0, driftTimer = 0;
let fallT = 0, fallDir = 1, newRecord = false;
let zoomPhase = 0;
const FALL_ANGLE = 0.62;   // 約 35 度就跌倒

function startGame() {
  theta = (Math.random() - 0.5) * 0.05; omega = 0;
  dist = 0; playTime = 0; drift = 0; driftTarget = 0; driftTimer = 0;
  tiltZero = tiltRaw;       // 以開始時手機的角度當作水平
  newRecord = false;
  state = 'play';
}

// ---------- 按鈕 ----------
let buttons = [];
function button(id, x, y, w, h, label, primary) {
  buttons.push({ id, x, y, w, h });
  ctx.save();
  rr(x, y, w, h, h / 2);
  if (primary) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#ffd75e'); g.addColorStop(1, '#d49a1a');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#3a2300';
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
    ctx.fillStyle = '#fff';
  }
  ctx.font = `900 ${Math.round(h * 0.46)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 2);
  ctx.restore();
}
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function tapAt(x, y) {
  for (const b of buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      if (b.id === 'start' || b.id === 'again') startGame();
      if (b.id === 'home') state = 'title';
      if (b.id === 'invert') { invert = !invert; try { localStorage.setItem('dw_invert', invert ? '1' : '0'); } catch (e) {} }
      return true;
    }
  }
  return false;
}
function toLogical(t) { return [t.clientX * DPR / SCALE, t.clientY * DPR / SCALE]; }
function updateTouches(e) {
  touchL = touchR = false;
  if (state !== 'play') return;
  for (const t of e.touches) {
    const [x] = toLogical(t);
    if (x < LW * 0.3) touchL = true;
    else if (x > LW * 0.7) touchR = true;
  }
}
cv.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) { const [x, y] = toLogical(t); tapAt(x, y); }
  updateTouches(e);
}, { passive: false });
cv.addEventListener('touchmove', e => { e.preventDefault(); updateTouches(e); }, { passive: false });
cv.addEventListener('touchend', e => { e.preventDefault(); updateTouches(e); }, { passive: false });
cv.addEventListener('mousedown', e => { const x = e.clientX * DPR / SCALE, y = e.clientY * DPR / SCALE; if (!tapAt(x, y) && state === 'play') { if (x < LW / 2) touchL = true; else touchR = true; } });
addEventListener('mouseup', () => { touchL = touchR = false; });

// ---------- 物理 ----------
function physics(dt) {
  playTime += dt;
  // 醉意：走越遠越醉，晃得越厲害
  const drunk = Math.min(1, 0.15 + dist / 300);
  driftTimer -= dt;
  if (driftTimer <= 0) {
    driftTarget = (Math.random() * 2 - 1) * (0.5 + 2.0 * drunk);
    driftTimer = 0.6 + Math.random() * 1.4;
  }
  drift += (driftTarget - drift) * Math.min(1, dt * 2.5);
  const gravity = 2.4 * Math.sin(theta);        // 一歪就越倒越歪
  const control = inputLean() * 4.6;              // 玩家把他推回來
  const alpha = gravity + drift + control - omega * 2.4;
  omega += alpha * dt;
  theta += omega * dt;
  const speed = 1.3 * (1 - Math.min(1, Math.abs(theta) / FALL_ANGLE) * 0.7); // 公尺/秒
  dist += speed * dt;
  zoomPhase += speed * dt * 0.09;
  walkFrame = (walkFrame + dt * 24 * (0.6 + 0.4 * speed / 1.3)) % N_WALK;
  if (Math.abs(theta) > FALL_ANGLE) {
    state = 'fall'; fallT = 0; fallDir = Math.sign(theta) || 1;
    const m = Math.floor(dist);
    if (m > best) { best = m; setBest(m); newRecord = true; }
  }
}

// ---------- 繪圖 ----------
function drawStreet(phase) {
  const im = imgs.street;
  if (!im || !im.width) { ctx.fillStyle = '#0d1530'; ctx.fillRect(0, 0, LW, LH); return; }
  // 「蓋滿」畫面的基本比例
  const base = Math.max(LW / im.width, LH / im.height);
  // 以路的盡頭（消失點）為中心縮放。人朝鏡頭走來，所以背景慢慢縮小（往後退），
  // 一輪結束時用淡入交疊接回去，看不出跳動。
  const ox0 = (LW - im.width * base) * 0.5, oy0 = LH - im.height * base;
  const vx = im.width * 0.80, vy = im.height * 0.53;
  const sx = ox0 + vx * base, sy = oy0 + vy * base;
  const layer = (z, a) => {
    if (a <= 0) return;
    const s = base * z;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(im, sx - vx * s, sy - vy * s, im.width * s, im.height * s);
    ctx.globalAlpha = 1;
  };
  const Z = 0.16, f = ((phase % 1) + 1) % 1;
  layer(1 + Z * (1 - f), 1);
  if (f > 0.75) layer(1 + Z * (2 - f), (f - 0.75) / 0.25);
}

function drawMan(frame, angle, list, groundY, h) {
  const im = list[Math.floor(frame) % list.length];
  if (!im || !im.width) return;
  const w = im.width * h / im.height;
  const cx = LW / 2;
  // 影子
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(cx + Math.sin(angle) * h * 0.15, groundY, w * 0.38, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 以腳底為軸心旋轉
  ctx.save();
  ctx.translate(cx, groundY);
  ctx.rotate(angle);
  ctx.drawImage(im, -w / 2, -h, w, h);
  ctx.restore();
}

function panel(x, y, w, h) {
  ctx.save(); rr(x, y, w, h, 22);
  ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(212,175,55,0.7)'; ctx.stroke(); ctx.restore();
}
function text(s, x, y, size, color, align = 'center', weight = 900) {
  ctx.font = `${weight} ${size}px sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function credit() {
  ctx.save();
  ctx.font = 'italic 600 24px sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#d4af37';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
  ctx.fillText(`${AUTHOR}　${VERSION}`, LW - 24, LH - 18);
  ctx.restore();
}

function drawHUD() {
  // 距離（左上）
  panel(20, 18, 270, 112);
  text('走了', 155, 46, 30, '#d4af37');
  text(`${Math.floor(dist)} 公尺`, 155, 94, 50, '#fff');
  // 最佳（右上）
  panel(LW - 290, 18, 270, 112);
  text('最佳紀錄', LW - 155, 46, 30, '#d4af37');
  text(`${best} 公尺`, LW - 155, 94, 50, '#fff');
  // 平衡條（上方中間）
  const bw = Math.min(560, LW - 640), bx = LW / 2 - bw / 2, by = 40, bh = 64;
  ctx.save(); rr(bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
  ctx.clip();
  ctx.fillStyle = 'rgba(46,157,79,0.55)'; ctx.fillRect(bx + bw * 0.35, by, bw * 0.3, bh);
  ctx.fillStyle = 'rgba(200,60,40,0.45)'; ctx.fillRect(bx, by, bw * 0.12, bh); ctx.fillRect(bx + bw * 0.88, by, bw * 0.12, bh);
  ctx.restore();
  const p = Math.max(-1, Math.min(1, theta / FALL_ANGLE));
  const dx = bx + bw / 2 + p * (bw / 2 - bh / 2);
  ctx.save(); ctx.shadowColor = '#ffcc33'; ctx.shadowBlur = 16; ctx.fillStyle = '#ffcc33';
  ctx.beginPath(); ctx.arc(dx, by + bh / 2, bh / 2 - 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 8;
  text('保持在綠色區', LW / 2, by + bh + 28, 28, '#fff', 'center', 700);
  ctx.restore();
  // 左右輔助按鈕（不想傾斜手機時用手指按）
  for (const [x, lab, on] of [[30, '◀', touchL], [LW - 150, '▶', touchR]]) {
    ctx.save(); rr(x, LH - 150, 120, 120, 60);
    ctx.fillStyle = on ? 'rgba(255,215,94,0.45)' : 'rgba(255,255,255,0.12)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke(); ctx.restore();
    text(lab, x + 60, LH - 90, 56, '#fff');
  }
}

function drawTitle() {
  drawStreet(now / 1000 * 0.02);
  drawMan(idleFrame, 0, imgs.idle, LH * 0.97, LH * 0.62);
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, LW, LH); ctx.restore();
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 18;
  text('醉漢回家', LW / 2, 92, 104, '#ffd75e');
  ctx.restore();
  // 左邊：說明；右邊：紀錄與開始
  panel(40, 190, 360, 210);
  text('怎麼玩', 220, 230, 34, '#d4af37');
  text('左右傾斜手機', 220, 290, 36, '#fff', 'center', 800);
  text('別讓他跌倒', 220, 345, 36, '#fff', 'center', 800);
  button('invert', 60, 425, 320, 80, invert ? '傾斜方向：相反' : '傾斜方向：正常', false);
  panel(LW - 400, 190, 360, 120);
  text('最佳紀錄', LW - 220, 228, 34, '#d4af37');
  text(`${best} 公尺`, LW - 220, 280, 48, '#fff');
  button('start', LW - 380, 340, 320, 110, '開始', true);
  credit();
}

function drawPlay() {
  drawStreet(zoomPhase);
  drawMan(walkFrame, theta, imgs.walk, LH * 0.97, LH * 0.62);
  drawHUD();
  credit();
}

function drawFall(dt) {
  fallT += dt;
  const k = Math.min(1, fallT / 0.7);
  const ang = fallDir * (FALL_ANGLE + (Math.PI / 2 - FALL_ANGLE) * k * k);
  const shake = fallT > 0.7 && fallT < 0.95 ? (Math.random() - 0.5) * 10 : 0;
  ctx.save(); ctx.translate(shake, shake * 0.5);
  drawStreet(zoomPhase);
  drawMan(walkFrame, ang, imgs.walk, LH * 0.97, LH * 0.62);
  ctx.restore();
  if (fallT > 1.3) state = 'result';
}

function drawResult() {
  drawStreet(zoomPhase);
  drawMan(walkFrame, fallDir * Math.PI / 2, imgs.walk, LH * 0.97, LH * 0.62);
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.66)'; ctx.fillRect(0, 0, LW, LH); ctx.restore();
  text('跌倒了！', LW / 2, 86, 88, '#ff7a59');
  text('這次走了', LW / 2, 178, 36, '#ddd', 'center', 700);
  text(`${Math.floor(dist)} 公尺`, LW / 2, 245, 80, '#ffd75e');
  text(newRecord ? '🎉 新紀錄！' : `最佳紀錄 ${best} 公尺`, LW / 2, 318, 36, newRecord ? '#7dff9a' : '#bbb', 'center', 800);
  button('again', LW / 2 - 340, 380, 320, 110, '再來一次', true);
  button('home', LW / 2 + 20, 380, 320, 110, '回主畫面', false);
  credit();
}

function drawLoading() {
  ctx.fillStyle = '#0d1530'; ctx.fillRect(0, 0, LW, LH);
  text('醉漢回家', LW / 2, LH / 2 - 80, 90, '#ffd75e');
  const w = 600, x = LW / 2 - w / 2, y = LH / 2 + 10;
  ctx.save(); rr(x, y, w, 40, 20); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
  rr(x, y, w * loaded / total, 40, 20); ctx.fillStyle = '#ffd75e'; ctx.fill(); ctx.restore();
  text('載入中…', LW / 2, y + 90, 36, '#fff', 'center', 700);
  credit();
  if (loaded >= total) state = 'title';
}

function frame(ts) {
  now = ts;
  const dt = Math.min(0.05, (ts - (last || ts)) / 1000);
  last = ts;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  buttons = [];
  idleFrame = (idleFrame + dt * 24) % N_IDLE;
  if (state === 'loading') drawLoading();
  else if (state === 'title') drawTitle();
  else if (state === 'play') { physics(dt); if (state === 'play') drawPlay(); else drawFall(0); }
  else if (state === 'fall') drawFall(dt);
  else if (state === 'result') drawResult();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
