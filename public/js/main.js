/* ==========================================================================
   科协优阅网 · 前端交互
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------- 移动端菜单 ---------------- */
  function initMobileMenu() {
    var btn = document.getElementById('mobileMenuBtn');
    var nav = document.getElementById('mobileNav');
    var overlay = document.getElementById('mobileMenuOverlay');
    if (!btn || !nav) return;
    function close() { btn.classList.remove('active'); nav.classList.remove('open'); overlay && overlay.classList.remove('open'); }
    btn.addEventListener('click', function () { btn.classList.toggle('active'); nav.classList.toggle('open'); overlay && overlay.classList.toggle('open'); });
    overlay && overlay.addEventListener('click', close);
    nav.querySelectorAll('.mobile-nav-group-title').forEach(function (t) {
      t.addEventListener('click', function () { t.nextElementSibling.classList.toggle('open'); });
    });
  }

  /* ---------------- 轮播 ---------------- */
  function initCarousel() {
    var root = document.querySelector('[data-carousel]');
    if (!root) return;
    var track = root.querySelector('.carousel-track');
    var slides = root.querySelectorAll('.carousel-slide');
    if (slides.length < 1) return;
    var dots = root.querySelector('.carousel-dots');
    var idx = 0, timer = null, n = slides.length;

    if (dots && n > 1) {
      for (var i = 0; i < n; i++) { var d = document.createElement('i'); d.dataset.i = i; dots.appendChild(d); }
      dots.addEventListener('click', function (e) { if (e.target.dataset.i !== undefined) go(+e.target.dataset.i); });
    }
    function render() {
      track.style.transform = 'translateX(' + (-idx * 100) + '%)';
      if (dots) Array.prototype.forEach.call(dots.children, function (d, i) { d.classList.toggle('on', i === idx); });
    }
    function go(i) { idx = (i + n) % n; render(); restart(); }
    function restart() { clearInterval(timer); if (n > 1) timer = setInterval(function () { idx = (idx + 1) % n; render(); }, 5000); }
    var p = root.querySelector('.carousel-btn.prev'), nx = root.querySelector('.carousel-btn.next');
    p && p.addEventListener('click', function () { go(idx - 1); });
    nx && nx.addEventListener('click', function () { go(idx + 1); });
    root.addEventListener('mouseenter', function () { clearInterval(timer); });
    root.addEventListener('mouseleave', restart);
    // 触摸滑动
    var sx = 0;
    root.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; clearInterval(timer); }, { passive: true });
    root.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 45) go(idx + (dx < 0 ? 1 : -1)); else restart();
    });
    render(); restart();
  }

  /* ---------------- 成果全屏查看器 ---------------- */
  var Viewer = {
    ids: [], pos: 0, cache: {},
    open: function (ids, pos) { this.ids = ids; this.pos = pos; this.show(); document.getElementById('viewer').classList.add('open'); document.body.style.overflow = 'hidden'; },
    close: function () { document.getElementById('viewer').classList.remove('open'); document.body.style.overflow = ''; },
    show: function () {
      var id = this.ids[this.pos];
      var self = this;
      var el = document.getElementById('viewer');
      function paint(c) {
        el.querySelector('.vt-title').textContent = (self.pos + 1) + ' / ' + self.ids.length + '　' + c.title;
        el.querySelector('.viewer-stage img').src = c.image_detail || c.image_thumb;
        el.querySelector('.viewer-info').innerHTML =
          '<h3>' + esc(c.title) + '</h3><dl>' +
          '<dt>比赛级别</dt><dd>' + esc(c.competition_level) + '</dd>' +
          '<dt>获奖等级</dt><dd>' + esc(c.award_level) + '</dd>' +
          '<dt>竞赛分类</dt><dd>' + esc(c.category_name || '-') + '</dd>' +
          '<dt>获奖年份</dt><dd>' + esc(c.year) + '</dd>' +
          '<dt>获奖学生</dt><dd>' + esc(c.students || '-') + '</dd>' +
          '<dt>浏览量</dt><dd>' + (c.view_count || 0) + '</dd></dl>';
      }
      if (this.cache[id]) paint(this.cache[id]);
      else fetch('/api/certificates/' + id).then(function (r) { return r.json(); }).then(function (j) { if (j.success) { self.cache[id] = j.data; paint(j.data); } });
    },
    step: function (d) { this.pos = (this.pos + d + this.ids.length) % this.ids.length; this.show(); }
  };

  function initViewer() {
    var el = document.getElementById('viewer');
    if (!el) return;
    el.querySelector('.viewer-close').addEventListener('click', function () { Viewer.close(); });
    el.addEventListener('click', function (e) { if (e.target === el) Viewer.close(); });
    el.querySelector('.viewer-nav.prev').addEventListener('click', function () { Viewer.step(-1); });
    el.querySelector('.viewer-nav.next').addEventListener('click', function () { Viewer.step(1); });
    document.addEventListener('keydown', function (e) {
      if (!el.classList.contains('open')) return;
      if (e.key === 'Escape') Viewer.close();
      if (e.key === 'ArrowLeft') Viewer.step(-1);
      if (e.key === 'ArrowRight') Viewer.step(1);
    });
    var sx = 0;
    el.querySelector('.viewer-stage').addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    el.querySelector('.viewer-stage').addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) Viewer.step(dx < 0 ? 1 : -1);
    });
  }

  function bindCertCards(scope) {
    var cards = (scope || document).querySelectorAll('.cert-card[data-id]');
    cards.forEach(function (card) {
      if (card.__bound) return; card.__bound = true;
      card.addEventListener('click', function () {
        var all = Array.prototype.slice.call(document.querySelectorAll('.cert-card[data-id]'));
        var ids = all.map(function (c) { return c.dataset.id; });
        Viewer.open(ids, ids.indexOf(card.dataset.id));
      });
    });
  }

  /* ---------------- 筛选与搜索 ---------------- */
  function initFilters() {
    var input = document.getElementById('search-input');
    if (!input) return;
    var btn = document.getElementById('search-btn');
    function apply() {
      var p = new URLSearchParams();
      var s = input && input.value.trim(); if (s) p.set('search', s);
      ['department-filter:department', 'year-filter:year', 'competition-level-filter:competition_level',
        'level-filter:level', 'category-filter:category'].forEach(function (pair) {
        var parts = pair.split(':');
        var el = document.getElementById(parts[0]);
        if (el && el.value) p.set(parts[1], el.value);
      });
      window.location.href = '/certs' + (p.toString() ? '?' + p.toString() : '');
    }
    btn && btn.addEventListener('click', apply);
    input && input.addEventListener('keypress', function (e) { if (e.key === 'Enter') apply(); });
    document.querySelectorAll('.filter-bar select').forEach(function (sel) { sel.addEventListener('change', apply); });
  }

  /* ---------------- 加载更多 ---------------- */
  function initLoadMore() {
    var btn = document.getElementById('loadMoreBtn');
    if (!btn) return;
    var grid = document.getElementById('certGrid');
    var page = parseInt(btn.dataset.page, 10) || 1;
    var total = parseInt(btn.dataset.total, 10) || 0;
    var loading = false;
    function load() {
      if (loading) return; loading = true;
      btn.textContent = '加载中…';
      var p = new URLSearchParams(window.location.search);
      p.set('page', page + 1); p.set('limit', 20);
      fetch('/api/certificates?' + p.toString()).then(function (r) { return r.json(); }).then(function (j) {
        j.data.forEach(function (c) { grid.insertAdjacentHTML('beforeend', cardHtml(c)); });
        page++; loading = false;
        bindCertCards(grid);
        if (page * 20 >= j.total) { btn.parentNode.style.display = 'none'; }
        else { btn.dataset.page = page; btn.textContent = '加载更多'; }
      }).catch(function () { loading = false; btn.textContent = '加载失败，点击重试'; });
    }
    btn.addEventListener('click', load);
    // 无限滚动
    var sentinel = document.createElement('div');
    btn.parentNode.appendChild(sentinel);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && page * 20 < total) load();
      }, { rootMargin: '300px' }).observe(sentinel);
    }
  }
  function cardHtml(c) {
    var meta = [c.category_name, c.competition_level, c.year].filter(Boolean).map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('');
    return '<div class="cert-card" data-id="' + c.id + '">' +
      '<div class="card-image"><img src="' + (c.image_thumb || c.image_detail) + '" alt="' + esc(c.title) + '" loading="lazy">' +
      '<div class="card-overlay"><span class="competition-level-badge">' + esc(c.competition_level) + '</span>' +
      '<span class="award-badge">' + esc(c.award_level) + '</span></div></div>' +
      '<div class="card-content"><h3 class="card-title">' + esc(c.title) + '</h3>' +
      '<p class="card-meta">' + meta + '</p><p class="card-students">' + esc(c.students) + '</p></div></div>';
  }

  /* ---------------- 赛事规划弹窗 ---------------- */
  function initPlanModal() {
    var cards = document.querySelectorAll('[data-event]');
    if (!cards.length) return;
    var modal = document.getElementById('planModal');
    if (!modal) return;
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        var e; try { e = JSON.parse(card.dataset.event); } catch (err) { return; }
        modal.querySelector('h3').textContent = e.event_name || '赛事详情';
        function row(k, v) { return v ? '<div class="row"><span class="k">' + k + '</span><span class="v">' + esc(v) + '</span></div>' : ''; }
        var time = e.competition_start_date ? e.competition_start_date + (e.competition_end_date ? ' ~ ' + e.competition_end_date : '') : '待定';
        modal.querySelector('.modal-body').innerHTML =
          row('比赛级别', e.competition_level) + row('比赛时间', time) +
          row('建议筹备开始', e.prep_start_date || '待定') +
          (e.description ? '<div class="row" style="display:block"><div class="k" style="margin-bottom:6px">比赛介绍</div><div style="color:#4a5568;line-height:1.8">' + esc(e.description) + '</div></div>' : '') +
          (e.official_url ? '<div style="margin-top:18px"><a class="btn sm" href="' + e.official_url + '" target="_blank" rel="noopener">访问官网 ↗</a></div>' : '');
        modal.classList.add('open');
      });
    });
    modal.querySelector('.modal-close').addEventListener('click', function () { modal.classList.remove('open'); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('open'); });
  }

  /* ---------------- 图库灯箱 ---------------- */
  function initLightbox() {
    var links = document.querySelectorAll('[data-lightbox]');
    if (!links.length) return;
    var box = document.createElement('div');
    box.className = 'viewer';
    box.innerHTML = '<div class="viewer-top"><span class="vt-title"></span><button class="viewer-close">×</button></div>' +
      '<div class="viewer-body" style="grid-template-columns:1fr"><div class="viewer-stage">' +
      '<img src="" alt=""><button class="viewer-nav prev">‹</button><button class="viewer-nav next">›</button></div></div>';
    document.body.appendChild(box);
    var imgs = Array.prototype.map.call(links, function (a) { return { src: a.getAttribute('href'), title: a.dataset.title || '' }; });
    var pos = 0;
    function show() { box.querySelector('img').src = imgs[pos].src; box.querySelector('.vt-title').textContent = (pos + 1) + ' / ' + imgs.length + '　' + imgs[pos].title; }
    function open(i) { pos = i; show(); box.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close() { box.classList.remove('open'); document.body.style.overflow = ''; }
    links.forEach(function (a, i) { a.addEventListener('click', function (e) { e.preventDefault(); open(i); }); });
    box.querySelector('.viewer-close').addEventListener('click', close);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    box.querySelector('.prev').addEventListener('click', function (e) { e.stopPropagation(); pos = (pos - 1 + imgs.length) % imgs.length; show(); });
    box.querySelector('.next').addEventListener('click', function (e) { e.stopPropagation(); pos = (pos + 1) % imgs.length; show(); });
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') { pos = (pos - 1 + imgs.length) % imgs.length; show(); }
      if (e.key === 'ArrowRight') { pos = (pos + 1) % imgs.length; show(); }
    });
  }

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', function () {
    initMobileMenu(); initCarousel(); initViewer(); bindCertCards(document);
    initFilters(); initLoadMore(); initPlanModal(); initLightbox();
  });
})();
