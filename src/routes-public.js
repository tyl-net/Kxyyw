'use strict';
/** 前台路由 */
const express = require('express');
const router = express.Router();
const { db, hashPassword, verifyPassword } = require('./db');
const H = require('./helpers');

/* ------------------------------------------------------------------ */
/* 成果查询                                                             */
/* ------------------------------------------------------------------ */
function queryCerts(q) {
  const where = ['status = 1'];
  const args = [];
  if (q.search) {
    where.push('(title LIKE ? OR students LIKE ? OR teachers LIKE ? OR category_name LIKE ?)');
    const k = `%${q.search}%`;
    args.push(k, k, k, k);
  }
  if (q.category) { where.push('category_id = ?'); args.push(Number(q.category)); }
  if (q.department) { where.push('department = ?'); args.push(q.department); }
  if (q.competition_level) { where.push('competition_level = ?'); args.push(q.competition_level); }
  if (q.year) { where.push('year = ?'); args.push(q.year); }
  if (q.level) { where.push('award_level = ?'); args.push(q.level); }
  const clause = 'WHERE ' + where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM certificate ${clause}`).get(...args).c;
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(60, parseInt(q.limit, 10) || 20);
  const rows = db.prepare(
    `SELECT * FROM certificate ${clause} ORDER BY is_featured DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...args, limit, (page - 1) * limit);
  return { total, page, limit, data: rows };
}

function categoriesWithCount() {
  return db.prepare(`
    SELECT c.id, c.name, COUNT(x.id) AS cnt
    FROM category c LEFT JOIN certificate x ON x.category_id = c.id AND x.status = 1
    GROUP BY c.id ORDER BY c.sort_order, c.id
  `).all();
}

function yearsList() {
  return db.prepare('SELECT DISTINCT year FROM certificate WHERE status=1 ORDER BY year DESC').all().map((r) => r.year);
}

/* ------------------------------------------------------------------ */
/* 首页                                                                 */
/* ------------------------------------------------------------------ */
router.get('/', (req, res) => {
  const featured = db.prepare(
    'SELECT * FROM certificate WHERE status=1 AND is_featured=1 ORDER BY id DESC LIMIT 10'
  ).all();
  const first = featured.length ? featured : db.prepare('SELECT * FROM certificate WHERE status=1 ORDER BY id DESC LIMIT 10').all();
  const latest = db.prepare('SELECT * FROM certificate WHERE status=1 ORDER BY id DESC LIMIT 20').all();
  res.render('index', {
    ...H.baseCtx(req), page: 'index',
    featured: first, latest,
    total: db.prepare('SELECT COUNT(*) AS c FROM certificate WHERE status=1').get().c,
    categories: categoriesWithCount(), years: yearsList(),
    stats: {
      certs: db.prepare('SELECT COUNT(*) AS c FROM certificate WHERE status=1').get().c,
      comps: db.prepare('SELECT COUNT(*) AS c FROM competition').get().c,
      works: db.prepare('SELECT COUNT(*) AS c FROM work').get().c,
      galleries: db.prepare('SELECT COUNT(*) AS c FROM gallery').get().c
    }
  });
});

/* ------------------------------------------------------------------ */
/* 竞赛成果                                                             */
/* ------------------------------------------------------------------ */
router.get('/certs', (req, res) => {
  const result = queryCerts(req.query);
  res.render('cert_list', {
    ...H.baseCtx(req), page: 'certs',
    ...result,
    categories: categoriesWithCount(), years: yearsList()
  });
});

/* ------------------------------------------------------------------ */
/* 赛事规划                                                             */
/* ------------------------------------------------------------------ */
router.get('/plan', (req, res) => {
  const year = req.query.year || '2026';
  const level = req.query.competition_level || '';
  let sql = 'SELECT * FROM event_plan WHERE year = ?';
  const args = [year];
  if (level) { sql += ' AND competition_level = ?'; args.push(level); }
  sql += ' ORDER BY COALESCE(competition_start_date, competition_end_date, prep_start_date), id';
  const events = db.prepare(sql).all(...args).map((e) => ({ ...e, gantt: H.ganttRange(e.competition_start_date, e.competition_end_date, e.prep_start_date) }));
  const years = db.prepare('SELECT DISTINCT year FROM event_plan ORDER BY year DESC').all().map((r) => r.year);
  res.render('event_plan', { ...H.baseCtx(req), page: 'plan', events, year, years, level });
});

/* ------------------------------------------------------------------ */
/* 赛事报名                                                             */
/* ------------------------------------------------------------------ */
router.get('/competitions', (req, res) => {
  const status = req.query.status || 'all';
  let sql = 'SELECT * FROM competition';
  const args = [];
  if (status !== 'all') { sql += ' WHERE status = ?'; args.push(Number(status)); }
  sql += ' ORDER BY status, id';
  const comps = db.prepare(sql).all(...args).map((c) => ({
    ...c,
    statusInfo: H.COMP_STATUS[c.status] || H.COMP_STATUS[1],
    applicants: db.prepare('SELECT COUNT(*) AS c FROM registration WHERE competition_id=?').get(c.id).c
  }));
  res.render('competition_list', { ...H.baseCtx(req), page: 'competitions', comps, status });
});

router.get('/competition/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM competition WHERE id=?').get(Number(req.params.id));
  if (!c) return res.status(404).render('404', { ...H.baseCtx(req), page: '' });
  const applicants = db.prepare('SELECT COUNT(*) AS c FROM registration WHERE competition_id=?').get(c.id).c;
  const approved = db.prepare('SELECT COUNT(*) AS c FROM registration WHERE competition_id=? AND status=1').get(c.id).c;
  const myReg = req.member
    ? db.prepare('SELECT * FROM registration WHERE competition_id=? AND member_id=?').get(c.id, req.member.id)
    : null;
  c.statusInfo = H.COMP_STATUS[c.status] || H.COMP_STATUS[1];
  res.render('competition_detail', {
    ...H.baseCtx(req), page: 'competitions', c,
    statusInfo: c.statusInfo,
    applicants, approved, myReg
  });
});

router.post('/competition/:id/register', (req, res) => {
  if (!req.member) return res.redirect('/login?redirect=' + encodeURIComponent('/competition/' + req.params.id));
  const id = Number(req.params.id);
  const exists = db.prepare('SELECT id FROM registration WHERE competition_id=? AND member_id=?').get(id, req.member.id);
  if (!exists) {
    db.prepare('INSERT INTO registration (competition_id,member_id,team_name,members,status,created_at) VALUES (?,?,?,?,?,?)')
      .run(id, req.member.id, req.body.team_name || '', req.body.members || req.member.real_name, 0,
        new Date().toISOString().slice(0, 19).replace('T', ' '));
  }
  res.redirect('/competition/' + id + '?registered=1');
});

/* ------------------------------------------------------------------ */
/* 赛事风采                                                             */
/* ------------------------------------------------------------------ */
router.get('/galleries', (req, res) => {
  const galleries = db.prepare('SELECT * FROM gallery ORDER BY event_date DESC, id DESC').all().map((g) => ({
    ...g, count: db.prepare('SELECT COUNT(*) AS c FROM gallery_image WHERE gallery_id=?').get(g.id).c
  }));
  res.render('gallery_list', { ...H.baseCtx(req), page: 'galleries', galleries });
});

router.get('/gallery/:id', (req, res) => {
  const g = db.prepare('SELECT * FROM gallery WHERE id=?').get(Number(req.params.id));
  if (!g) return res.status(404).render('404', { ...H.baseCtx(req), page: '' });
  const images = db.prepare('SELECT * FROM gallery_image WHERE gallery_id=? ORDER BY sort_order, id').all(g.id);
  res.render('gallery_detail', { ...H.baseCtx(req), page: 'galleries', g, images });
});

/* ------------------------------------------------------------------ */
/* 作品展示                                                             */
/* ------------------------------------------------------------------ */
const WORK_CATS = ['软件作品', '硬件作品', '毕业设计', '参赛作品'];
router.get('/works', (req, res) => {
  let sql = 'SELECT * FROM work';
  const where = [], args = [];
  if (req.query.category) { where.push('category_name = ?'); args.push(req.query.category); }
  if (req.query.department) { where.push('department = ?'); args.push(req.query.department); }
  if (req.query.year) { where.push('year = ?'); args.push(req.query.year); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY is_featured DESC, id DESC';
  const works = db.prepare(sql).all(...args);
  const counts = {};
  WORK_CATS.forEach((c) => { counts[c] = db.prepare('SELECT COUNT(*) AS c FROM work WHERE category_name=?').get(c).c; });
  res.render('works', {
    ...H.baseCtx(req), page: 'works', works, workCats: WORK_CATS, counts,
    total: db.prepare('SELECT COUNT(*) AS c FROM work').get().c,
    years: db.prepare('SELECT DISTINCT year FROM work ORDER BY year DESC').all().map((r) => r.year)
  });
});

router.get('/work/:id', (req, res) => {
  const w = db.prepare('SELECT * FROM work WHERE id=?').get(Number(req.params.id));
  if (!w) return res.status(404).render('404', { ...H.baseCtx(req), page: '' });
  res.render('work_detail', { ...H.baseCtx(req), page: 'works', w });
});

/* ------------------------------------------------------------------ */
/* 榜样力量                                                             */
/* ------------------------------------------------------------------ */
router.get('/role-models', (req, res) => {
  const roles = db.prepare('SELECT * FROM role_model ORDER BY sort_order, id').all();
  res.render('role_models', { ...H.baseCtx(req), page: 'role-models', roles });
});
router.get('/role-model/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM role_model WHERE id=?').get(Number(req.params.id));
  if (!r) return res.status(404).render('404', { ...H.baseCtx(req), page: '' });
  res.render('role_model_detail', { ...H.baseCtx(req), page: 'role-models', r });
});

/* ------------------------------------------------------------------ */
/* 协会组织                                                             */
/* ------------------------------------------------------------------ */
router.get('/organization', (req, res) => {
  const years = db.prepare('SELECT DISTINCT year FROM org_member ORDER BY year DESC').all().map((r) => r.year);
  const year = req.query.year || years[0] || '2026';
  const rows = db.prepare('SELECT * FROM org_member WHERE year=? ORDER BY sort_order, id').all(year);
  const deptOrder = ['主席团', '行政部', '算法部', '项目部', '网络安全部', '硬件部'];
  const map = {};
  rows.forEach((r) => {
    if (!map[r.department]) map[r.department] = { name: r.department, desc: r.department_desc, members: [] };
    map[r.department].members.push(r);
  });
  const departments = Object.values(map).sort(
    (a, b) => (deptOrder.indexOf(a.name) + 99) % 999 - (deptOrder.indexOf(b.name) + 99) % 999
  );
  res.render('organization', { ...H.baseCtx(req), page: 'organization', departments, years, year });
});

/* ------------------------------------------------------------------ */
/* 文章                                                                 */
/* ------------------------------------------------------------------ */
router.get('/articles', (req, res) => {
  const cat = req.query.category_id || '';
  let sql = 'SELECT id,title,category,author,view_count,created_at FROM article';
  const args = [];
  if (cat) { sql += ' WHERE category = ?'; args.push(cat); }
  sql += ' ORDER BY created_at DESC';
  const articles = db.prepare(sql).all(...args);
  const cats = db.prepare('SELECT category, COUNT(*) AS cnt FROM article GROUP BY category').all();
  res.render('articles', { ...H.baseCtx(req), page: '', articles, cats, cat });
});

router.get('/article/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM article WHERE id=?').get(Number(req.params.id));
  if (!a) return res.status(404).render('404', { ...H.baseCtx(req), page: '' });
  db.prepare('UPDATE article SET view_count = view_count + 1 WHERE id=?').run(a.id);
  res.render('article_detail', { ...H.baseCtx(req), page: '', a });
});

/* ------------------------------------------------------------------ */
/* 会员系统                                                             */
/* ------------------------------------------------------------------ */
router.get('/login', (req, res) => {
  if (req.member) return res.redirect('/member');
  res.render('member_login', { ...H.baseCtx(req), page: '', error: null, redirect: req.query.redirect || '' });
});

router.post('/login', (req, res) => {
  const { account, password } = req.body;
  const m = db.prepare('SELECT * FROM member WHERE username=? OR student_no=?').get(account, account);
  if (!m || !verifyPassword(password, m.password_hash)) {
    return res.render('member_login', { ...H.baseCtx(req), page: '', error: '账号或密码错误', redirect: req.body.redirect || '' });
  }
  if (!m.status) return res.render('member_login', { ...H.baseCtx(req), page: '', error: '该账号已被禁用，请联系管理员', redirect: '' });
  req.session.memberId = m.id;
  res.redirect(req.body.redirect || '/member');
});

router.get('/register', (req, res) => {
  if (req.member) return res.redirect('/member');
  res.render('member_register', { ...H.baseCtx(req), page: '', error: null, form: {} });
});

router.post('/register', (req, res) => {
  const { username, real_name, student_no, identity, password, password2 } = req.body;
  const form = { username, real_name, student_no, identity };
  const fail = (msg) => res.render('member_register', { ...H.baseCtx(req), page: '', error: msg, form });

  if (!username || username.length < 3 || username.length > 20) return fail('用户名长度应为 3-20 个字符');
  if (!/^[A-Za-z0-9_\u4e00-\u9fa5]+$/.test(username)) return fail('用户名只能包含字母、数字、下划线或中文');
  if (!real_name) return fail('请填写姓名');
  if (!student_no) return fail('请填写学号/工号');
  if (!password || password.length < 8) return fail('密码长度至少 8 位');
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (kinds < 2) return fail('密码至少包含大写字母、小写字母、数字、符号中的两种');
  if (password !== password2) return fail('两次输入的密码不一致');
  if (db.prepare('SELECT id FROM member WHERE username=?').get(username)) return fail('该用户名已被注册');
  if (db.prepare('SELECT id FROM member WHERE student_no=?').get(student_no)) return fail('该学号/工号已被注册');

  const info = db.prepare(
    'INSERT INTO member (username,real_name,student_no,identity,password_hash,created_at) VALUES (?,?,?,?,?,?)'
  ).run(username, real_name, student_no, identity || '学生', hashPassword(password),
    new Date().toISOString().slice(0, 19).replace('T', ' '));
  req.session.memberId = Number(info.lastInsertRowid);
  res.redirect('/member');
});

router.get('/qq_login', (req, res) => {
  // 模拟第三方登录：自动创建/登录一个 QQ 演示账号
  let m = db.prepare('SELECT * FROM member WHERE username=?').get('qq_user');
  if (!m) {
    const info = db.prepare('INSERT INTO member (username,real_name,student_no,identity,password_hash,created_at) VALUES (?,?,?,?,?,?)')
      .run('qq_user', 'QQ用户', 'QQ' + Date.now().toString().slice(-8), '学生', hashPassword('Qq@' + Date.now()),
        new Date().toISOString().slice(0, 19).replace('T', ' '));
    m = db.prepare('SELECT * FROM member WHERE id=?').get(Number(info.lastInsertRowid));
  }
  req.session.memberId = m.id;
  res.redirect('/member');
});

router.get('/logout', (req, res) => {
  req.session.memberId = null;
  res.redirect('/');
});

router.get('/member', (req, res) => {
  if (!req.member) return res.redirect('/login?redirect=/member');
  const certs = db.prepare(
    'SELECT * FROM certificate WHERE students LIKE ? AND status=1 ORDER BY id DESC'
  ).all(`%${req.member.real_name}%`);
  const regs = db.prepare(
    'SELECT r.*, c.title FROM registration r JOIN competition c ON c.id=r.competition_id WHERE r.member_id=? ORDER BY r.id DESC'
  ).all(req.member.id);
  res.render('member_center', { ...H.baseCtx(req), page: '', certs, regs });
});

router.post('/member/profile', (req, res) => {
  if (!req.member) return res.redirect('/login');
  db.prepare('UPDATE member SET real_name=?, identity=? WHERE id=?')
    .run(req.body.real_name || req.member.real_name, req.body.identity || req.member.identity, req.member.id);
  res.redirect('/member?updated=1');
});

module.exports = router;
