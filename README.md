# 科协优阅网 · 学科竞赛综合管理平台

依据 [需求分析说明书](docs/需求分析说明书.md)，对 `https://youyue.info/` 的功能与数据结构进行完整复刻并工程化实现的一套可独立运行的系统。

---

## 一、技术栈

| 层面 | 选型 |
| --- | --- |
| 运行时 | Node.js 18+（推荐 22 LTS） |
| Web 框架 | Express 4 |
| 模板引擎 | EJS（服务端渲染，利于 SEO） |
| 数据库 | SQLite（Node 内置 `node:sqlite`，**零外部依赖、无需安装数据库**） |
| 会话 | Cookie + 内存 Session（HttpOnly） |
| 密码 | `scrypt` 加盐哈希 |
| 前端 | 原生 HTML5 / CSS3 / ES6，无框架依赖 |
| 素材 | 自研 SVG 占位图（证书 / 照片 / 头像），离线可用 |

---

## 二、快速开始

```bash
cd youyue-system
npm install          # 安装 express / ejs / cookie-parser
npm start            # 启动服务，默认 3000 端口
```

启动后访问：

| 入口 | 地址 | 账号 |
| --- | --- | --- |
| 前台 | http://localhost:3000/ | — |
| 会员登录 | http://localhost:3000/login | `demo` / `Demo@1234` |
| 会员注册 | http://localhost:3000/register | 自行注册 |
| 管理后台 | http://localhost:3000/admin/login | `admin` / `Admin@123` |

首次启动会自动建库（`data/youyue.db`）并导入种子数据（`data/seed.json`，含 168 条真实竞赛成果）。如需重置数据，删除 `data/youyue.db` 后重启即可。

---

## 三、目录结构

```
youyue-system/
├── server.js                # 服务入口：中间件、会话、素材路由、API、路由挂载
├── package.json
├── data/
│   ├── seed.json            # 种子数据（成果/赛事/图库/作品/榜样/组织/分类）
│   └── youyue.db            # SQLite 数据库（首次启动自动生成）
├── docs/
│   └── 需求分析说明书.md      # 详细需求分析（SRS）
├── src/
│   ├── db.js                # 建表 + 种子导入 + 密码哈希
│   ├── helpers.js           # 模板上下文、格式化、甘特图计算
│   ├── images.js            # SVG 素材生成器
│   ├── routes-public.js     # 前台路由（8 大栏目 + 会员系统）
│   └── routes-admin.js      # 管理后台路由（看板 + 通用 CRUD）
├── views/
│   ├── partials/            # header / footer
│   ├── admin/               # 后台：_head / _foot / login / dashboard / list / form
│   └── *.ejs                # 18 个前台页面模板
└── public/
    ├── css/style.css        # 全站样式（含响应式）
    └── js/main.js           # 交互：轮播 / 全屏查看器 / 筛选 / 加载更多 / 灯箱 / 弹窗
```

---

## 四、功能清单

### 前台（8 大栏目 + 会员）

| 栏目 | 路由 | 说明 |
| --- | --- | --- |
| 首页 | `/` | 搜索筛选条、精选成果轮播、数据概览、成果瀑布流 |
| 竞赛成果 | `/certs` | 分类侧栏（含计数）、院系/年份/级别/等级多维筛选、搜索、分页加载、证书全屏查看器 |
| 赛事规划 | `/plan` | 年度/级别切换、甘特图时间轴（筹备期 + 比赛期）、赛事卡片、详情弹窗 |
| 赛事报名 | `/competitions` | 状态筛选、赛事卡片、报名人数 |
| 赛事详情 | `/competition/:id` | 赛事信息、统计、比赛介绍与规则、在线报名 |
| 赛事风采 | `/galleries` `/gallery/:id` | 图库网格、照片九宫格与灯箱浏览 |
| 作品展示 | `/works` `/work/:id` | 分类/院系/年份筛选、作品详情 |
| 榜样力量 | `/role-models` `/role-model/:id` | 人物卡片与详情 |
| 协会组织 | `/organization` | 年度切换、部门区块、成员卡片 |
| 文章资讯 | `/articles` `/article/:id` | 分类侧栏、文章详情、阅读量统计 |
| 会员系统 | `/login` `/register` `/member` `/qq_login` | 注册校验、登录、个人中心、QQ 登录（模拟） |

### 管理后台（`/admin`）

- 数据看板：8 项统计卡片 + 分类/级别/年份/等级分布图
- 内容管理：竞赛成果、赛事规划、赛事报名、赛事风采、作品展示、榜样力量、协会组织、文章管理、会员管理
- 通用能力：列表、搜索、新增、编辑、删除、精选/状态切换

---

## 五、核心数据

| 维度 | 数值 |
| --- | --- |
| 竞赛成果 | 168 条（蓝桥杯 92、计算机能力挑战赛 35、数字媒体科技作品 11…） |
| 比赛级别 | 省级 139 / 国家级 28 / 全球级 1 |
| 获奖等级 | 三等奖 86 / 二等奖 51 / 一等奖 21 / 优秀奖 7 / 特等奖 2 / 铜奖 1 |
| 赛事风采 | 18 个图集 |
| 年度赛事规划 | 10 项（2026 年度） |
| 协会组织 | 4 个年度 × 6 个部门 |

---

## 六、主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/certificates` | 成果查询，支持 `search / category / department / competition_level / year / level / page / limit` |
| GET | `/api/certificates/featured?count=10` | 精选成果 |
| GET | `/api/certificates/:id` | 成果详情（自动累加浏览量） |
| GET | `/img/cert/:id.svg` | 动态证书图 |
| GET | `/img/galphoto/:gid/:idx.svg` | 动态图库照片 |
| GET | `/img/avatar/:name.svg` | 动态头像 |

---

## 七、安全性说明

- 密码使用 `scrypt` 加盐哈希存储，数据库中不存明文；
- 会话 Cookie 设置 `HttpOnly`、`SameSite=Lax`，有效期 12 小时；
- 所有数据库访问采用参数化查询（`?` 占位），防止 SQL 注入；
- 模板默认 HTML 转义，动态 JSON 属性单独做属性级转义，防止 XSS；
- 后台路由统一前置登录拦截，未登录一律跳转 `/admin/login`。
