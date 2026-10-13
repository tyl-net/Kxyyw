'use strict';
/**
 * 数据访问层：基于 node:sqlite（零外部依赖）
 * 负责：建库建表、种子数据导入、通用查询封装
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'youyue.db');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);

/* ------------------------------------------------------------------ */
/* 密码哈希                                                             */
/* ------------------------------------------------------------------ */
function hashPassword(pwd, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(pwd), s, 32).toString('hex');
  return `scrypt$${s}$${h}`;
}
function verifyPassword(pwd, stored) {
  if (!stored) return false;
  const parts = String(stored).split('$');
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  const h = crypto.scryptSync(String(pwd), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
}
function genSalt() { return crypto.randomBytes(16).toString('hex'); }

/* ------------------------------------------------------------------ */
/* 建表                                                                 */
/* ------------------------------------------------------------------ */
function createSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS category (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS certificate (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, category_id INTEGER, category_name TEXT,
    competition_level TEXT, award_level TEXT, year TEXT,
    students TEXT, teachers TEXT DEFAULT '', department TEXT DEFAULT '',
    image_detail TEXT, image_thumb TEXT,
    view_count INTEGER DEFAULT 0, is_featured INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS event_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year TEXT, competition_level TEXT, event_name TEXT,
    prep_start_date TEXT, competition_start_date TEXT, competition_end_date TEXT,
    official_url TEXT, description TEXT DEFAULT '', sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS competition (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT, subtitle TEXT DEFAULT '', competition_level TEXT,
    type TEXT DEFAULT 'non_work', status INTEGER DEFAULT 1,
    allow_team INTEGER DEFAULT 0, team_max INTEGER DEFAULT 1,
    reg_start TEXT, reg_end TEXT, review_method TEXT DEFAULT '在线评审',
    content TEXT DEFAULT '', rules TEXT DEFAULT '', cover TEXT,
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS registration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER, member_id INTEGER, team_name TEXT DEFAULT '',
    members TEXT DEFAULT '', status INTEGER DEFAULT 0, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT, description TEXT DEFAULT '', event_date TEXT,
    cover TEXT, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS gallery_image (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gallery_id INTEGER, image_path TEXT, caption TEXT DEFAULT '', sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS work (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT, category_id INTEGER, category_name TEXT,
    author TEXT, year TEXT, department TEXT DEFAULT '',
    description TEXT DEFAULT '', cover TEXT, is_featured INTEGER DEFAULT 0, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS role_model (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, photo TEXT, bio TEXT DEFAULT '',
    honors TEXT DEFAULT '', message TEXT DEFAULT '', sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS org_member (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year TEXT, department TEXT, department_desc TEXT DEFAULT '',
    name TEXT, position TEXT DEFAULT '', avatar TEXT DEFAULT '', sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS article (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT, category TEXT DEFAULT '学习心得', author TEXT DEFAULT '',
    content TEXT DEFAULT '', view_count INTEGER DEFAULT 0, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS member (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL, real_name TEXT, student_no TEXT UNIQUE,
    identity TEXT DEFAULT '学生', password_hash TEXT, avatar TEXT DEFAULT '',
    status INTEGER DEFAULT 1, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL, password_hash TEXT, created_at TEXT
  );
  `);
}

/* ------------------------------------------------------------------ */
/* 种子数据                                                             */
/* ------------------------------------------------------------------ */
function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM certificate').get().c;
  if (count > 0) return false;
  if (!fs.existsSync(SEED_FILE)) { console.warn('[seed] 未找到 data/seed.json，跳过'); return false; }
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const insCat = db.prepare('INSERT OR IGNORE INTO category (id,name,sort_order) VALUES (?,?,?)');
  (seed.categories || []).forEach((c, i) => insCat.run(c.id, c.name, i));

  const insCert = db.prepare(`INSERT INTO certificate
    (id,title,category_id,category_name,competition_level,award_level,year,students,teachers,
     department,image_detail,image_thumb,view_count,is_featured,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  (seed.certs || []).forEach((c) => {
    insCert.run(Number(c.id), c.title, Number(c.category_id) || 0, c.category_name,
      c.competition_level, c.award_level, c.year, c.students, c.teachers || '',
      c.department || (c.category_name ? '计算机工程学院' : ''),
      `/img/cert/${c.id}.svg`, `/img/cert/${c.id}.svg`,
      Number(c.view_count) || 0, Number(c.is_featured) || 0, 1, now);
  });

  const insEv = db.prepare(`INSERT INTO event_plan
    (id,year,competition_level,event_name,prep_start_date,competition_start_date,
     competition_end_date,official_url,description) VALUES (?,?,?,?,?,?,?,?,?)`);
  (seed.events || []).forEach((e, i) => {
    insEv.run(Number(e.id), e.year || '2026', e.competition_level || '其他', e.event_name,
      e.prep_start_date || null, e.competition_start_date || null, e.competition_end_date || null,
      e.official_url || '', e.description || '');
  });

  const insComp = db.prepare(`INSERT INTO competition
    (title,subtitle,competition_level,type,status,allow_team,team_max,reg_start,reg_end,
     review_method,content,rules,cover,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  (seed.competitions || []).forEach((c) => {
    insComp.run(c.title, '非作品类比赛', c.level, c.type === '作品类' ? 'work' : 'non_work',
      statusCode(c.status), 1, 5,
      (c.times[0] || '').slice(0, 10) || null, (c.times[0] || '').slice(-5) || null,
      '在线评审', '本次赛事采用在线评审方式，由专业评委进行评分。',
      '报名前请仔细阅读比赛通知和详情，确保符合参赛条件；个人赛每人只能报名一次，团队赛由队长统一报名。',
      `/img/comp/${1}.svg`, now);
  });
  // 演示赛事（补足体验）
  const demo = [
    ['计算机工程学院第四届科协杯程序设计竞赛', '程序设计 · 非作品类', '校级', 'non_work', 2, 1, 5,
      '2026-11-01 00:00', '2026-11-10 23:59', '在线评审',
      '面向全院学生的程序设计竞赛，为蓝桥杯等赛事热身，包含 8 道算法题，比赛时长 4 小时。',
      '个人赛每人只能报名一次；比赛期间禁止联网查阅资料；使用指定在线评测系统提交。'],
    ['2026 年"桂北杯"网络安全 CTF 竞赛', '网络安全 · 非作品类', '校级', 'non_work', 1, 1, 4,
      '2026-12-05 09:00', '2026-12-12 18:00', '攻防实战评审',
      '以 CTF 夺旗赛形式开展，涵盖 Web、逆向、密码学、杂项等方向，考察学生的安全攻防实践能力。',
      '允许 1-4 人组队；禁止攻击竞赛平台以外的任何目标；禁止交换 flag。'],
    ['2026 年创新创业作品大赛', '创新创业 · 作品类', '校级', 'work', 3, 1, 6,
      '2026-09-01 00:00', '2026-09-20 23:59', '专家评审',
      '面向全院征集创新创业作品，需提交项目计划书与原型 Demo，优秀作品将推荐参加中国国际大学生创新大赛。',
      '作品必须原创，需提交完整材料；评审分初评与终评两个阶段。']
  ];
  demo.forEach((d) => insComp.run(d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9], d[10], d[11], '/img/comp/2.svg', now));

  const insGal = db.prepare('INSERT INTO gallery (id,title,description,event_date,cover,created_at) VALUES (?,?,?,?,?,?)');
  const insGalImg = db.prepare('INSERT INTO gallery_image (gallery_id,image_path,caption,sort_order) VALUES (?,?,?,?)');
  (seed.galleries || []).forEach((g) => {
    insGal.run(Number(g.id), g.title, g.desc || '', g.date || '', `/img/gal/${g.id}.svg`, now);
    const n = (g.images || []).length || parseInt((g.count || '1').replace(/\D/g, ''), 10) || 1;
    for (let i = 0; i < Math.min(n, 12); i++) insGalImg.run(Number(g.id), `/img/galphoto/${g.id}/${i + 1}.svg`, '', i);
  });

  const insWork = db.prepare(`INSERT INTO work
    (title,category_id,category_name,author,year,department,description,cover,is_featured,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  (seed.works || []).forEach((w) => {
    insWork.run(w.title, Number(w.category_id) || 3, w.category_name || '毕业设计', w.author || '秦浩',
      w.year || '2023', '计算机工程学院', w.description || '', `/img/work/${w.id}.svg`, 1, now);
  });

  const insRole = db.prepare('INSERT INTO role_model (id,name,photo,bio,honors,message,sort_order) VALUES (?,?,?,?,?,?,?)');
  (seed.roleModels || []).forEach((r, i) =>
    insRole.run(Number(r.id), r.name, `/img/role/${r.id}.svg`, r.bio || '',
      '蓝桥杯全国一等奖；校三好学生；优秀学生干部', '愿你在代码的世界里，始终保持热爱与好奇。', i));
  // 演示榜样
  const extraRoles = [
    ['何添', '21 级计算机科学与技术专业，24 届科协算法部负责人，华为 ICT 大赛全球特等奖得主。', '华为 ICT 大赛全球特等奖；ACM 区域赛铜奖；多次获得校级奖学金。', '把每一次训练都当成正式比赛，结果自然不会差。'],
    ['汤嘉诚', '22 级软件工程专业，25 届科协主席，蓝桥杯国家级一等奖获得者。', '蓝桥杯国家级一等奖；计算机能力挑战赛省级一等奖。', '独行快，众行远。科协是我们共同的舞台。'],
    ['冯高友', '21 级网络工程专业，睿抗机器人开发者大赛国家级一等奖获得者。', '睿抗国家级一等奖；数字媒体科技作品竞赛国家级三等奖。', '保持对技术的敬畏，也保持对未知的好奇。']
  ];
  extraRoles.forEach((r, i) => insRole.run(100 + i, r[0], `/img/role/${100 + i}.svg`, r[1], r[2], r[3], 10 + i));

  const insOrg = db.prepare(`INSERT INTO org_member
    (year,department,department_desc,name,position,avatar,sort_order) VALUES (?,?,?,?,?,?,?)`);
  const deptDesc = {
    '主席团': '负责协会整体工作，统筹各部门协调',
    '行政部': '负责日常行政事务、会议组织、档案管理，以及协会宣传与对外联络',
    '算法部': '负责算法竞赛培训、技术交流与赛前集训',
    '项目部': '负责赛事策划、项目管理、对外合作',
    '网络安全部': '负责网络安全竞赛培训、安全防护与攻防演练',
    '硬件部': '负责硬件类竞赛培训、嵌入式与机器人方向技术攻关'
  };
  const org2026 = [
    ['主席团', '汤嘉诚', '主席'], ['主席团', '黄宇', '副主席'],
    ['行政部', '梁春桐', '部长'], ['行政部', '周诗怡', '副部长'],
    ['算法部', '何添', '部长'], ['算法部', '麦庆龙', '副部长'],
    ['项目部', '冯高友', '部长'], ['项目部', '钟简忆', '副部长'],
    ['网络安全部', '黄宇', '部长'], ['网络安全部', '唐树华', '副部长'],
    ['硬件部', '李丽', '部长'], ['硬件部', '张金盛', '副部长']
  ];
  org2026.forEach((m, i) =>
    insOrg.run('2026', m[0], deptDesc[m[0]] || '', m[1], m[2], `/img/avatar.png`, i));
  const org2025 = [
    ['主席团', '汤嘉诚', '主席'], ['主席团', '梁庆吉', '副主席'],
    ['行政部', '王婷婷', '部长'], ['算法部', '何添', '部长'],
    ['项目部', '冯高友', '部长'], ['网络安全部', '王正一', '部长'], ['硬件部', '刘越杰', '部长']
  ];
  org2025.forEach((m, i) =>
    insOrg.run('2025', m[0], deptDesc[m[0]] || '', m[1], m[2], `/img/avatar.png`, i));
  const org2024 = [
    ['主席团', '王正一', '主席'], ['主席团', '陈斯奇', '副主席'],
    ['行政部', '周尚锋', '部长'], ['算法部', '蒙贇俊', '部长'],
    ['项目部', '韦中基', '部长'], ['网络安全部', '韦少华', '部长']
  ];
  org2024.forEach((m, i) =>
    insOrg.run('2024', m[0], deptDesc[m[0]] || '', m[1], m[2], `/img/avatar.png`, i));
  const org2023 = [
    ['主席团', '韦国勤', '主席'], ['行政部', '黄思顺', '部长'],
    ['算法部', '唐树华', '部长'], ['项目部', '李俊豪', '部长'], ['网络安全部', '何之记', '部长']
  ];
  org2023.forEach((m, i) =>
    insOrg.run('2023', m[0], deptDesc[m[0]] || '', m[1], m[2], `/img/avatar.png`, i));

  const insArt = db.prepare('INSERT INTO article (id,title,category,author,content,view_count,created_at) VALUES (?,?,?,?,?,?,?)');
  insArt.run(1, '计算机工程学院科学创新技术协会简介', '网站帮助', '青枫', ARTICLE_INTRO, 1036, '2026-07-13 18:03');
  insArt.run(2, '博客分享', '学习心得', '黄宇', '<p>欢迎各位师傅访问 HACKED 的博客。</p><p>这里会不定期分享网络安全、CTF 竞赛以及算法学习的一些心得和笔记，欢迎交流。</p>', 16, '2026-09-13 16:00');
  insArt.run(3, '蓝桥杯备赛经验分享', '学习心得', '汤嘉诚', ARTICLE_BLOG, 528, '2026-08-20 10:12');

  const insMember = db.prepare('INSERT INTO member (username,real_name,student_no,identity,password_hash,created_at) VALUES (?,?,?,?,?,?)');
  insMember.run('demo', '演示用户', '2021001', '学生', hashPassword('Demo@1234'), now);

  const insAdmin = db.prepare('INSERT INTO admin (username,password_hash,created_at) VALUES (?,?,?)');
  insAdmin.run('admin', hashPassword('Admin@123'), now);

  console.log('[seed] 初始化完成');
  return true;
}

function statusCode(label) {
  const map = { '即将开始': 1, '报名中': 2, '评审中': 3, '已结束': 4 };
  return map[label] || 1;
}

const ARTICLE_INTRO = `
<p>计算机工程学院科学创新技术协会（英文译名：Scientific Innovation and Technology Association，简称"科协（SITA）"），是由计算机工程学院专业指导教师、辅导员指导老师与学生共同参与组建的科技类学生组织。科协致力于通过在院内举办各类学科竞赛，充分调动学院学生的学习热情，营造浓厚的学习氛围，切实提升学生的学科竞赛竞争力，为学院培养更多具有创新精神和实践能力的高素质人才。</p>
<h2>一、协会概况</h2>
<p>科协以培养学院全体学生科技素养为基石，将提升学科竞赛能力作为核心任务，以提高专业学习兴趣为重要目标。通过组织各类学科竞赛和科技活动，科协不仅有力推动了学院"以赛促学"良好风气的形成，还极大地激发了学生对计算机科技领域的探索欲望，促使他们主动学习更专业的技能。</p>
<h2>二、协会功能</h2>
<p>同时，科协的工作也为学院的教学改革、课程体系构建以及人才培养方案的完善提供了有力的辅助和支持，在学院发展中发挥着不可或缺的作用。</p>
<h2>三、组织架构与职责</h2>
<p>协会组织架构分为主席团、行政部、项目部、算法部、网络安全部、硬件部。其中主席团和行政部为协会管理部门；项目部、算法部、网络安全部、硬件部为学科竞赛部门。各部门如需场地、物料等资源，可报行政部提交上报审核，或者直接与指导老师反馈，尽力为学生提供良好的学习交流环境。</p>
<h3>（一）主席团</h3>
<p>协会主席统筹管理整个社团的活动；每位副主席分管一个部门，监督所分管部门的有序运行。主要职责包括制度与文化建设、方向引领与指导、监督与汇报、对外交流与合作。</p>
<h3>（二）行政部</h3>
<p>负责事务协调与上传下达、会议组织、档案管理、财务与物资管理，以及协会的宣传工作。</p>
<h3>（三）算法部 / 项目部 / 网络安全部 / 硬件部</h3>
<p>分别负责算法竞赛、赛事策划与项目管理、网络安全竞赛、硬件与机器人方向的技术培训、集训与参赛组织工作。</p>
`;

const ARTICLE_BLOG = `
<p>蓝桥杯是很多同学接触的第一个大型算法竞赛，这里分享一些我的备赛经验。</p>
<h2>一、打牢基础</h2>
<p>首先要熟练掌握 C++ / Java / Python 中至少一门语言，熟悉基本的输入输出、字符串处理、数组与容器。基础不牢，后面的题目会越做越吃力。</p>
<h2>二、系统刷题</h2>
<p>建议按照"数据结构 → 基础算法 → 动态规划 → 图论"的顺序系统推进，每个专题至少完成 30 道题目，并把错题整理成自己的题单。</p>
<h2>三、模拟实战</h2>
<p>赛前一个月开始进行整场模拟，严格按照比赛时长训练，锻炼心态和时间分配能力。很多同学不是不会做，而是时间不够用。</p>
<h2>四、结伴同行</h2>
<p>加入协会的集训队，和队友一起讨论、一起复盘，进步会比一个人快很多。祝大家都能取得理想的成绩！</p>
`;

module.exports = { db, createSchema, seed, hashPassword, verifyPassword, genSalt, DB_FILE };
