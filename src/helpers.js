'use strict';
/** 共享工具函数与模板上下文 */

const NAV = [
  { key: 'index', label: '首页', href: '/' },
  { key: 'certs', label: '竞赛成果', href: '/certs' },
  { key: 'plan', label: '赛事规划', href: '/plan' },
  { key: 'competitions', label: '赛事报名', href: '/competitions' },
  { key: 'galleries', label: '赛事风采', href: '/galleries' },
  { key: 'works', label: '作品展示', href: '/works' },
  { key: 'role-models', label: '榜样力量', href: '/role-models' },
  {
    key: 'organization', label: '协会组织', href: '/organization',
    children: [
      { label: '协会简介', href: '/article/1' },
      { label: '旧版优阅网', href: 'http://old.youyue.info', external: true }
    ]
  }
];

const SITE = {
  name: '科协优阅网',
  subtitle: '学科竞赛综合管理平台',
  org: '计算机工程学院科学创新技术协会（SITA）',
  icp: '桂ICP备11002647号-9'
};

const LEVELS = ['全球级', '国家级', '省级', '市级', '校级', '其他'];
const AWARDS = ['特等奖', '一等奖', '二等奖', '三等奖', '金奖', '银奖', '铜奖', '优秀奖', '其他'];
const DEPARTMENTS = ['计算机工程学院', '计算机学院'];

const COMP_STATUS = {
  1: { label: '即将开始', cls: 'status-soon' },
  2: { label: '报名中', cls: 'status-open' },
  3: { label: '评审中', cls: 'status-review' },
  4: { label: '已结束', cls: 'status-ended' }
};

/** 级别 -> 颜色 */
const LEVEL_CLASS = {
  '全球级': 'lv-global', '国家级': 'lv-national', '省级': 'lv-province',
  '市级': 'lv-city', '校级': 'lv-school', '其他': 'lv-other'
};

function fmtDate(d) {
  if (!d) return '';
  return String(d).slice(0, 10).replace(/-/g, '-');
}
function fmtMonth(d) {
  if (!d) return '';
  const s = String(d);
  const m = s.slice(5, 7);
  return m ? `${parseInt(m, 10)}月` : '';
}
function fmtDay(d) {
  if (!d) return '';
  const s = String(d);
  return s.slice(8, 10) ? String(parseInt(s.slice(8, 10), 10)) : '';
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function studentsList(s) {
  return String(s || '').split(/[,，、]/).map((x) => x.trim()).filter(Boolean);
}
/** 计算赛事在甘特图上的位置（按 1-12 月） */
function ganttRange(start, end, prep) {
  const monthOf = (d) => (d ? parseInt(String(d).slice(5, 7), 10) : null);
  const s = monthOf(start), e = monthOf(end) || s, p = monthOf(prep);
  if (!s) return null;
  const left = ((s - 1) / 12) * 100;
  const width = Math.max(((e - s + 1) / 12) * 100, 100 / 12);
  let prepLeft = null, prepWidth = null;
  if (p && p < s) {
    prepLeft = ((p - 1) / 12) * 100;
    prepWidth = Math.max(((s - p) / 12) * 100, 100 / 12 * 0.6);
  }
  return {
    left: left.toFixed(2), width: width.toFixed(2),
    prepLeft: prepLeft === null ? null : prepLeft.toFixed(2),
    prepWidth: prepWidth === null ? null : prepWidth.toFixed(2),
    startMonth: s, endMonth: e
  };
}

function baseCtx(req) {
  return {
    SITE,
    NAV,
    currentPath: req.path,
    member: req.member || null,
    admin: req.admin || null,
    LEVELS, AWARDS, DEPARTMENTS, COMP_STATUS, LEVEL_CLASS,
    fmtDate, fmtMonth, fmtDay, esc, studentsList, ganttRange,
    query: req.query || {}
  };
}

module.exports = {
  NAV, SITE, LEVELS, AWARDS, DEPARTMENTS, COMP_STATUS, LEVEL_CLASS,
  fmtDate, fmtMonth, fmtDay, esc, studentsList, ganttRange, baseCtx
};
