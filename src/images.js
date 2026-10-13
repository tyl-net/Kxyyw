'use strict';
/**
 * 素材生成：自研 SVG 占位图，保证系统离线可运行、视觉统一
 */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 依据字符串生成稳定的色相
function hue(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) % 360;
  return h;
}

// 中英文混排换行（按视觉宽度估算）
function wrap(text, max) {
  const lines = [];
  let cur = '';
  let w = 0;
  for (const ch of String(text)) {
    const cw = /[\u4e00-\u9fa5]/.test(ch) ? 2 : 1;
    if (w + cw > max) { lines.push(cur); cur = ch; w = cw; }
    else { cur += ch; w += cw; }
  }
  if (cur) lines.push(cur);
  return lines;
}

const LEVEL_COLOR = {
  '全球级': '#f6b93b', '国家级': '#e55039', '省级': '#3867d6',
  '市级': '#20bf6b', '校级': '#8854d0', '其他': '#8395a7'
};

/**
 * 证书图片：模拟一张带边框与奖项丝带的证书
 */
function certificate({ id = 1, title = '', level = '省级', award = '三等奖', year = '' }) {
  const h = hue(id + title);
  const accent = LEVEL_COLOR[level] || '#3867d6';
  const lines = wrap(title, 16).slice(0, 4);
  const lh = 34;
  const startY = 250 - (lines.length - 1) * lh / 2;
  const textSvg = lines.map((l, i) =>
    `<text x="400" y="${startY + i * lh}" text-anchor="middle" font-size="28" font-family="'Microsoft YaHei','PingFang SC',sans-serif" font-weight="700" fill="#2c3e50">${esc(l)}</text>`
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" width="800" height="560">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${h},70%,72%)"/>
      <stop offset="100%" stop-color="hsl(${(h + 45) % 360},65%,58%)"/>
    </linearGradient>
    <linearGradient id="rib" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.7"/>
    </linearGradient>
  </defs>
  <rect width="800" height="560" fill="url(#bg)"/>
  <rect x="26" y="26" width="748" height="508" rx="10" fill="#fdfcf8" opacity="0.97"/>
  <rect x="42" y="42" width="716" height="476" rx="6" fill="none" stroke="${accent}" stroke-width="3"/>
  <rect x="56" y="56" width="688" height="448" rx="4" fill="none" stroke="${accent}" stroke-width="1" opacity="0.5"/>
  <text x="400" y="130" text-anchor="middle" font-size="34" font-family="'STKaiti','KaiTi',serif" font-weight="700" fill="${accent}" letter-spacing="8">获 奖 证 书</text>
  <line x1="270" y1="152" x2="530" y2="152" stroke="${accent}" stroke-width="2" opacity="0.6"/>
  ${textSvg}
  <text x="400" y="360" text-anchor="middle" font-size="22" font-family="'Microsoft YaHei',sans-serif" fill="#7f8c8d">${esc(level)} · ${esc(award)}</text>
  <text x="400" y="410" text-anchor="middle" font-size="18" font-family="'Microsoft YaHei',sans-serif" fill="#95a5a6">${esc(year)} 年度学科竞赛获奖成果</text>
  <g transform="translate(640,430)">
    <circle r="46" fill="none" stroke="${accent}" stroke-width="3" opacity="0.75"/>
    <circle r="36" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.5"/>
    <text y="8" text-anchor="middle" font-size="18" font-family="'STKaiti','KaiTi',serif" fill="${accent}" opacity="0.85">优阅</text>
  </g>
  <rect x="60" y="486" width="680" height="8" fill="url(#rib)" opacity="0.85"/>
</svg>`;
}

/** 图片类素材（图库/作品封面） */
function photo({ id = 1, title = '', tag = 'PHOTO', badge = '' }) {
  const h = hue(id + title);
  const lines = wrap(title, 18).slice(0, 2);
  const textSvg = lines.map((l, i) =>
    `<text x="400" y="${300 + i * 30}" text-anchor="middle" font-size="24" font-family="'Microsoft YaHei',sans-serif" font-weight="600" fill="#fff">${esc(l)}</text>`
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <defs>
    <linearGradient id="p" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${h},62%,55%)"/>
      <stop offset="100%" stop-color="hsl(${(h + 60) % 360},58%,38%)"/>
    </linearGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1.6" fill="#ffffff" opacity="0.16"/>
    </pattern>
  </defs>
  <rect width="800" height="500" fill="url(#p)"/>
  <rect width="800" height="500" fill="url(#dots)"/>
  <circle cx="690" cy="90" r="120" fill="#fff" opacity="0.08"/>
  <circle cx="110" cy="430" r="150" fill="#fff" opacity="0.07"/>
  <g transform="translate(48,56)">
    <rect width="120" height="34" rx="17" fill="#ffffff" opacity="0.25"/>
    <text x="60" y="23" text-anchor="middle" font-size="15" font-family="'Microsoft YaHei',sans-serif" fill="#fff" letter-spacing="1">${esc(tag)}</text>
  </g>
  ${textSvg}
  ${badge ? `<g transform="translate(48,410)"><rect width="${20 + badge.length * 15}" height="36" rx="18" fill="#ffffff" opacity="0.9"/><text x="${(20 + badge.length * 15) / 2}" y="24" text-anchor="middle" font-size="16" font-family="'Microsoft YaHei',sans-serif" font-weight="700" fill="hsl(${h},60%,38%)">${esc(badge)}</text></g>` : ''}
</svg>`;
}

/** 人物头像占位（首字 + 渐变圆） */
function avatar({ name = '用', size = 300 }) {
  const h = hue(name);
  const ch = String(name).slice(0, 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="${size}" height="${size}">
  <defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="hsl(${h},65%,65%)"/><stop offset="100%" stop-color="hsl(${(h + 50) % 360},60%,45%)"/>
  </linearGradient></defs>
  <rect width="300" height="300" rx="24" fill="url(#a)"/>
  <text x="150" y="196" text-anchor="middle" font-size="140" font-family="'Microsoft YaHei',sans-serif" font-weight="700" fill="#ffffff" opacity="0.95">${esc(ch)}</text>
</svg>`;
}

module.exports = { certificate, photo, avatar, LEVEL_COLOR, esc };
