'use strict';
/** 管理后台路由 */
const express = require('express');
const router = express.Router();
const { db, hashPassword } = require('./db');
const H = require('./helpers');

/* ------------------------------------------------------------------ */
/* 资源定义（驱动通用 CRUD）                                            */
/* ------------------------------------------------------------------ */
const RESOURCES = {
  certs: {
    table: 'certificate', title: '竞赛成果', order: 'id DESC',
    list: ['id', 'title', 'category_name', 'competition_level', 'award_level', 'year', 'students', 'is_featured', 'view_count'],
    labels: { id: 'ID', title: '成果名称', category_name: '竞赛分类', competition_level: '级别', award_level: '奖项', year: '年份', students: '获奖学生', is_featured: '精选', view_count: '浏览' },
    fields: [
      { name: 'title', label: '成果名称', type: 'text', required: true },
      { name: 'category_name', label: '竞赛分类', type: 'text' },
      { name: 'category_id', label: '分类ID', type: 'number' },
      { name: 'competition_level', label: '比赛级别', type: 'select', options: H.LEVELS },
      { name: 'award_level', label: '获奖等级', type: 'select', options: H.AWARDS },
      { name: 'year', label: '获奖年份', type: 'text' },
      { name: 'students', label: '获奖学生', type: 'text', hint: '多个用英文逗号分隔' },
      { name: 'teachers', label: '指导教师', type: 'text' },
      { name: 'department', label: '院系', type: 'select', options: H.DEPARTMENTS },
      { name: 'is_featured', label: '设为精选', type: 'switch' },
      { name: 'status', label: '状态(1启用)', type: 'number', def: 1 }
    ]
  },
  plans: {
    table: 'event_plan', title: '赛事规划', order: 'id DESC',
    list: ['id', 'year', 'event_name', 'competition_level', 'prep_start_date', 'competition_start_date', 'competition_end_date'],
    labels: { id: 'ID', year: '年度', event_name: '赛事名称', competition_level: '级别', prep_start_date: '筹备开始', competition_start_date: '比赛开始', competition_end_date: '比赛结束' },
    fields: [
      { name: 'year', label: '年度', type: 'text', required: true, def: '2026' },
      { name: 'event_name', label: '赛事名称', type: 'text', required: true },
      { name: 'competition_level', label: '级别', type: 'select', options: H.LEVELS },
      { name: 'prep_start_date', label: '筹备开始', type: 'date' },
      { name: 'competition_start_date', label: '比赛开始', type: 'date' },
      { name: 'competition_end_date', label: '比赛结束', type: 'date' },
      { name: 'official_url', label: '官网链接', type: 'text' },
      { name: 'description', label: '赛事介绍', type: 'textarea' }
    ]
  },
  competitions: {
    table: 'competition', title: '赛事报名', order: 'id DESC',
    list: ['id', 'title', 'competition_level', 'type', 'status', 'reg_start', 'reg_end'],
    labels: { id: 'ID', title: '赛事名称', competition_level: '级别', type: '类型', status: '状态', reg_start: '报名开始', reg_end: '报名结束' },
    fields: [
      { name: 'title', label: '赛事名称', type: 'text', required: true },
      { name: 'subtitle', label: '副标题', type: 'text' },
      { name: 'competition_level', label: '级别', type: 'select', options: H.LEVELS },
      { name: 'type', label: '类型', type: 'select', options: [['non_work', '非作品类'], ['work', '作品类']] },
      { name: 'status', label: '状态', type: 'select', options: [[1, '即将开始'], [2, '报名中'], [3, '评审中'], [4, '已结束']] },
      { name: 'allow_team', label: '允许团队报名(1/0)', type: 'number', def: 1 },
      { name: 'team_max', label: '团队最大人数', type: 'number', def: 5 },
      { name: 'reg_start', label: '报名开始', type: 'text' },
      { name: 'reg_end', label: '报名结束', type: 'text' },
      { name: 'review_method', label: '评审方式', type: 'text' },
      { name: 'content', label: '比赛详情', type: 'textarea' },
      { name: 'rules', label: '比赛规则', type: 'textarea' }
    ]
  },
  galleries: {
    table: 'gallery', title: '赛事风采', order: 'id DESC',
    list: ['id', 'title', 'event_date', 'description'],
    labels: { id: 'ID', title: '图库标题', event_date: '日期', description: '描述' },
    fields: [
      { name: 'title', label: '图库标题', type: 'text', required: true },
      { name: 'event_date', label: '日期', type: 'text' },
      { name: 'description', label: '描述', type: 'textarea' }
    ]
  },
  works: {
    table: 'work', title: '作品展示', order: 'id DESC',
    list: ['id', 'title', 'category_name', 'author', 'year', 'department', 'is_featured'],
    labels: { id: 'ID', title: '作品名称', category_name: '分类', author: '作者', year: '年份', department: '院系', is_featured: '精选' },
    fields: [
      { name: 'title', label: '作品名称', type: 'text', required: true },
      { name: 'category_name', label: '分类', type: 'select', options: ['软件作品', '硬件作品', '毕业设计', '参赛作品'] },
      { name: 'author', label: '作者', type: 'text' },
      { name: 'year', label: '创作年份', type: 'text' },
      { name: 'department', label: '院系', type: 'select', options: H.DEPARTMENTS },
      { name: 'description', label: '作品说明', type: 'textarea' },
      { name: 'is_featured', label: '设为精选', type: 'switch' }
    ]
  },
  roles: {
    table: 'role_model', title: '榜样力量', order: 'sort_order, id',
    list: ['id', 'name', 'bio'],
    labels: { id: 'ID', name: '姓名', bio: '简介' },
    fields: [
      { name: 'name', label: '姓名', type: 'text', required: true },
      { name: 'bio', label: '个人简介', type: 'textarea' },
      { name: 'honors', label: '所获荣誉', type: 'textarea' },
      { name: 'message', label: '寄语', type: 'textarea' },
      { name: 'sort_order', label: '排序', type: 'number', def: 0 }
    ]
  },
  org: {
    table: 'org_member', title: '协会组织', order: 'year DESC, sort_order, id',
    list: ['id', 'year', 'department', 'name', 'position'],
    labels: { id: 'ID', year: '年度', department: '部门', name: '姓名', position: '职务' },
    fields: [
      { name: 'year', label: '年度', type: 'text', required: true, def: '2026' },
      { name: 'department', label: '部门', type: 'text', required: true },
      { name: 'department_desc', label: '部门职责', type: 'textarea' },
      { name: 'name', label: '姓名', type: 'text', required: true },
      { name: 'position', label: '职务', type: 'text' },
      { name: 'sort_order', label: '排序', type: 'number', def: 0 }
    ]
  },
  articles: {
    table: 'article', title: '文章管理', order: 'id DESC',
    list: ['id', 'title', 'category', 'author', 'view_count', 'created_at'],
    labels: { id: 'ID', title: '标题', category: '分类', author: '作者', view_count: '阅读', created_at: '创建时间' },
    fields: [
      { name: 'title', label: '标题', type: 'text', required: true },
      { name: 'category', label: '分类', type: 'text', def: '学习心得' },
      { name: 'author', label: '作者', type: 'text' },
      { name: 'content', label: '正文(HTML)', type: 'textarea' }
    ]
  },
  members: {
    table: 'member', title: '会员管理', order: 'id DESC',
    list: ['id', 'username', 'real_name', 'student_no', 'identity', 'status', 'created_at'],
    labels: { id: 'ID', username: '用户名', real_name: '姓名', student_no: '学号/工号', identity: '身份', status: '状态', created_at: '注册时间' },
    fields: [
      { name: 'real_name', label: '姓名', type: 'text' },
      { name: 'identity', label: '身份', type: 'select', options: ['学生', '教师'] },
      { name: 'status', label: '状态(1启用/0禁用)', type: 'number', def: 1 }
    ],
    noCreate: true
  }
};

/* ------------------------------------------------------------------ */
/* 登录                                                                 */
/* ------------------------------------------------------------------ */
router.get('/login', (req, res) => {
  if (req.admin) return res.redirect('/admin');
  res.render('admin/login', { ...H.baseCtx(req), error: null });
});
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const a = db.prepare('SELECT * FROM admin WHERE username=?').get(username);
  const { verifyPassword } = require('./db');
  if (!a || !verifyPassword(password, a.password_hash)) {
    return res.render('admin/login', { ...H.baseCtx(req), error: '用户名或密码错误' });
  }
  req.session.adminId = a.id;
  res.redirect('/admin');
});
router.get('/logout', (req, res) => { req.session.adminId = null; res.redirect('/admin/login'); });

/* 之后的路由均需登录 */
router.use((req, res, next) => {
  if (!req.admin) return res.redirect('/admin/login');
  next();
});

/* ------------------------------------------------------------------ */
/* 看板                                                                 */
/* ------------------------------------------------------------------ */
router.get('/', (req, res) => {
  const stats = {
    certs: db.prepare('SELECT COUNT(*) AS c FROM certificate').get().c,
    events: db.prepare('SELECT COUNT(*) AS c FROM event_plan').get().c,
    comps: db.prepare('SELECT COUNT(*) AS c FROM competition').get().c,
    galleries: db.prepare('SELECT COUNT(*) AS c FROM gallery').get().c,
    works: db.prepare('SELECT COUNT(*) AS c FROM work').get().c,
    roles: db.prepare('SELECT COUNT(*) AS c FROM role_model').get().c,
    members: db.prepare('SELECT COUNT(*) AS c FROM member').get().c,
    regs: db.prepare('SELECT COUNT(*) AS c FROM registration').get().c
  };
  const byCategory = db.prepare('SELECT category_name AS k, COUNT(*) AS v FROM certificate GROUP BY category_name ORDER BY v DESC LIMIT 8').all();
  const byLevel = db.prepare('SELECT competition_level AS k, COUNT(*) AS v FROM certificate GROUP BY competition_level ORDER BY v DESC').all();
  const byYear = db.prepare('SELECT year AS k, COUNT(*) AS v FROM certificate GROUP BY year ORDER BY k DESC').all();
  const byAward = db.prepare('SELECT award_level AS k, COUNT(*) AS v FROM certificate GROUP BY award_level ORDER BY v DESC').all();
  res.render('admin/dashboard', { ...H.baseCtx(req), stats, byCategory, byLevel, byYear, byAward, RESOURCES });
});

/* ------------------------------------------------------------------ */
/* 通用 CRUD                                                            */
/* ------------------------------------------------------------------ */
router.get('/:res', (req, res, next) => {
  const cfg = RESOURCES[req.params.res];
  if (!cfg) return next();
  const q = req.query.q || '';
  let rows;
  const cols = db.prepare(`PRAGMA table_info(${cfg.table})`).all().map((c) => c.name);
  if (q && cols.includes('title')) {
    rows = db.prepare(`SELECT * FROM ${cfg.table} WHERE title LIKE ? ORDER BY ${cfg.order} LIMIT 500`).all(`%${q}%`);
  } else if (q && cols.includes('name')) {
    rows = db.prepare(`SELECT * FROM ${cfg.table} WHERE name LIKE ? ORDER BY ${cfg.order} LIMIT 500`).all(`%${q}%`);
  } else {
    rows = db.prepare(`SELECT * FROM ${cfg.table} ORDER BY ${cfg.order} LIMIT 500`).all();
  }
  res.render('admin/list', { ...H.baseCtx(req), cfg, resKey: req.params.res, rows, q });
});

router.get('/:res/new', (req, res, next) => {
  const cfg = RESOURCES[req.params.res];
  if (!cfg || cfg.noCreate) return next();
  res.render('admin/form', { ...H.baseCtx(req), cfg, resKey: req.params.res, row: {}, mode: 'new' });
});

router.get('/:res/:id/edit', (req, res, next) => {
  const cfg = RESOURCES[req.params.res];
  if (!cfg) return next();
  const row = db.prepare(`SELECT * FROM ${cfg.table} WHERE id=?`).get(Number(req.params.id));
  if (!row) return next();
  res.render('admin/form', { ...H.baseCtx(req), cfg, resKey: req.params.res, row, mode: 'edit' });
});

router.post('/:res/save', (req, res, next) => {
  const cfg = RESOURCES[req.params.res];
  if (!cfg) return next();
  const names = cfg.fields.map((f) => f.name);
  const vals = cfg.fields.map((f) => {
    if (f.type === 'switch') return req.body[f.name] ? 1 : 0;
    const v = req.body[f.name];
    return v === undefined || v === '' ? null : v;
  });
  const id = req.body.__id;
  try {
    if (id) {
      const set = names.map((n) => `${n}=?`).join(',');
      db.prepare(`UPDATE ${cfg.table} SET ${set} WHERE id=?`).run(...vals, Number(id));
    } else {
      const ph = names.map(() => '?').join(',');
      const extra = cfg.table === 'article' ? ',created_at' : '';
      const extraV = cfg.table === 'article' ? `,'${new Date().toISOString().slice(0, 19).replace('T', ' ')}'` : '';
      db.prepare(`INSERT INTO ${cfg.table} (${names.join(',')}${extra}) VALUES (${ph}${extraV})`).run(...vals);
    }
    res.redirect(`/admin/${req.params.res}?ok=1`);
  } catch (e) {
    res.render('admin/form', { ...H.baseCtx(req), cfg, resKey: req.params.res, row: req.body, mode: req.body.__id ? 'edit' : 'new', error: String(e.message) });
  }
});

router.post('/:res/:id/delete', (req, res, next) => {
  const cfg = RESOURCES[req.params.res];
  if (!cfg) return next();
  db.prepare(`DELETE FROM ${cfg.table} WHERE id=?`).run(Number(req.params.id));
  res.redirect(`/admin/${req.params.res}?ok=1`);
});

module.exports = router;
