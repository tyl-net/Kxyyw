'use strict';
/**
 * 科协优阅网 —— 学科竞赛综合管理平台
 * 服务入口：Express + node:sqlite + EJS
 */
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { db, createSchema, seed } = require('./src/db');
const img = require('./src/images');
const H = require('./src/helpers');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------- 初始化数据库 ---------------- */
createSchema();
seed();

/* ---------------- 基础中间件 ---------------- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));

/* ---------------- 会话（内存） ---------------- */
const sessions = new Map();
const SESSION_TTL = 1000 * 60 * 60 * 12;
function cleanSessions() {
  const now = Date.now();
  for (const [k, v] of sessions) if (v.exp < now) sessions.delete(k);
}
setInterval(cleanSessions, 1000 * 60 * 30).unref?.();

app.use((req, res, next) => {
  let sid = req.cookies['yy_sid'];
  if (!sid || !sessions.has(sid)) {
    sid = crypto.randomBytes(18).toString('hex');
    sessions.set(sid, { data: {}, exp: Date.now() + SESSION_TTL });
    res.cookie('yy_sid', sid, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_TTL });
  }
  const s = sessions.get(sid);
  s.exp = Date.now() + SESSION_TTL;
  req.session = new Proxy(s.data, {
    get: (t, k) => (k === 'destroy' ? () => sessions.delete(sid) : t[k]),
    set: (t, k, v) => { t[k] = v; return true; }
  });
  req.sessionId = sid;
  // 注入当前登录用户
  if (req.session.memberId) {
    req.member = db.prepare('SELECT id,username,real_name,student_no,identity,created_at FROM member WHERE id=?').get(req.session.memberId) || null;
    if (!req.member) req.session.memberId = null;
  }
  if (req.session.adminId) {
    req.admin = db.prepare('SELECT id,username FROM admin WHERE id=?').get(req.session.adminId) || null;
    if (!req.admin) req.session.adminId = null;
  }
  next();
});

/* ---------------- 动态素材 ---------------- */
function svg(res, body, cache = true) {
  res.set('Content-Type', 'image/svg+xml; charset=utf-8');
  if (cache) res.set('Cache-Control', 'public, max-age=86400');
  res.send(body);
}
app.get('/img/cert/:id.svg', (req, res) => {
  const c = db.prepare('SELECT * FROM certificate WHERE id=?').get(Number(req.params.id));
  if (!c) return svg(res, img.certificate({ id: req.params.id, title: '竞赛获奖证书' }));
  svg(res, img.certificate({ id: c.id, title: c.title, level: c.competition_level, award: c.award_level, year: c.year }));
});
app.get('/img/galphoto/:gid/:idx.svg', (req, res) => {
  const g = db.prepare('SELECT * FROM gallery WHERE id=?').get(Number(req.params.gid));
  const idx = req.params.idx;
  svg(res, img.photo({
    id: `gp${req.params.gid}-${idx}`,
    title: g ? g.title : '赛事瞬间',
    tag: '现场照片',
    badge: '第 ' + idx + ' 张'
  }));
});
app.get('/img/gal/:id.svg', (req, res) => {
  const g = db.prepare('SELECT * FROM gallery WHERE id=?').get(Number(req.params.id));
  if (!g) return svg(res, img.photo({ id: req.params.id, title: '赛事风采', tag: 'EVENT' }));
  svg(res, img.photo({ id: 'g' + g.id, title: g.title, tag: '赛事风采', badge: g.event_date }));
});
app.get('/img/work/:id.svg', (req, res) => {
  const w = db.prepare('SELECT * FROM work WHERE id=?').get(Number(req.params.id));
  if (!w) return svg(res, img.photo({ id: req.params.id, title: '作品展示', tag: 'WORK' }));
  svg(res, img.photo({ id: 'w' + w.id, title: w.title, tag: w.category_name || '作品', badge: w.year }));
});
app.get('/img/role/:id.svg', (req, res) => {
  const r = db.prepare('SELECT * FROM role_model WHERE id=?').get(Number(req.params.id));
  svg(res, img.photo({ id: 'r' + req.params.id, title: r ? r.name : '榜样力量', tag: '榜样力量' }));
});
app.get('/img/comp/:id.svg', (req, res) => {
  const c = db.prepare('SELECT * FROM competition WHERE id=?').get(Number(req.params.id));
  if (!c) return svg(res, img.photo({ id: req.params.id, title: '赛事报名', tag: '竞赛' }));
  svg(res, img.photo({ id: 'c' + c.id, title: c.title, tag: c.type === 'work' ? '作品类' : '非作品类',
    badge: (H.COMP_STATUS[c.status] || {}).label || '' }));
});
const AVATARS = ['汤嘉诚', '黄宇', '梁春桐', '周诗怡', '何添', '麦庆龙', '冯高友', '钟简忆', '唐树华', '李丽', '张金盛', '王正一', '陈斯奇', '梁庆吉', '王婷婷', '刘越杰', '蒙贇俊', '韦中基', '韦少华', '周尚锋', '韦国勤', '黄思顺', '李俊豪', '何之记'];
app.get('/img/avatar/:name.svg', (req, res) => svg(res, img.avatar({ name: decodeURIComponent(req.params.name) })));
app.get('/img/avatar.png', (req, res) => svg(res, img.avatar({ name: '科' })));
app.get('/img/logo.svg', (req, res) => svg(res, img.avatar({ name: '阅' })));

/* ---------------- API ---------------- */
app.get('/api/certificates', (req, res) => {
  const q = req.query;
  const where = ['status = 1'];
  const args = [];
  if (q.search) { where.push('(title LIKE ? OR students LIKE ? OR teachers LIKE ? OR category_name LIKE ?)'); const k = `%${q.search}%`; args.push(k, k, k, k); }
  if (q.category) { where.push('category_id = ?'); args.push(Number(q.category)); }
  if (q.department) { where.push('department = ?'); args.push(q.department); }
  if (q.competition_level) { where.push('competition_level = ?'); args.push(q.competition_level); }
  if (q.year) { where.push('year = ?'); args.push(q.year); }
  if (q.level) { where.push('award_level = ?'); args.push(q.level); }
  const clause = 'WHERE ' + where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM certificate ${clause}`).get(...args).c;
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(60, parseInt(q.limit, 10) || 20);
  const data = db.prepare(`SELECT * FROM certificate ${clause} ORDER BY is_featured DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...args, limit, (page - 1) * limit);
  res.json({ success: true, total, page, limit, data });
});
app.get('/api/certificates/featured', (req, res) => {
  const count = Math.min(20, parseInt(req.query.count, 10) || 10);
  res.json({ success: true, data: db.prepare('SELECT * FROM certificate WHERE status=1 AND is_featured=1 ORDER BY id DESC LIMIT ?').all(count) });
});
app.get('/api/certificates/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM certificate WHERE id=?').get(Number(req.params.id));
  if (!c) return res.status(404).json({ success: false, message: '未找到该成果' });
  db.prepare('UPDATE certificate SET view_count = view_count + 1 WHERE id=?').run(c.id);
  res.json({ success: true, data: c });
});

/* ---------------- 页面路由 ---------------- */
app.use('/', require('./src/routes-public'));
app.use('/admin', require('./src/routes-admin'));

/* ---------------- 404 / 500 ---------------- */
app.use((req, res) => {
  if (req.path.startsWith('/admin')) {
    return res.redirect('/admin/login');
  }
  res.status(404).render('404', { ...H.baseCtx(req), page: '' });
});
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('服务器内部错误：' + err.message);
});

app.listen(PORT, () => {
  console.log(`\n  科协优阅网 · 学科竞赛综合管理平台`);
  console.log(`  ▶ 前台： http://localhost:${PORT}/`);
  console.log(`  ▶ 后台： http://localhost:${PORT}/admin/login   (admin / Admin@123)`);
  console.log(`  ▶ 会员： demo / Demo@1234\n`);
});
