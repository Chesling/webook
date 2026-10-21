/* 微书 WeBook —— 原型（同时是产品真身的网页层） */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var KEY = 'webook.v1';
  var FS = '-apple-system,"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

  /* 卡片基准尺寸：宽 900，图片区高 540，文字区高 280 */
  var CW = 900, CH = 820, IMGH = 540;
  var FONT_BASE = [32, 42, 52, 62, 74];
  var FONT_LABELS = ['小', '中', '大', '特大', '巨大'];
  var COVER_COLORS = ['#9FE1CB', '#FAC775', '#B5D4F4', '#F4C0D1', '#C0DD97', '#CECBF6'];
  var THEMES = {
    white: { key: 'white', name: '白底黑字', bg: '#FFFFFF', text: '#16150F', sub: '#6A695F', img: '#F1EFE8' },
    dark: { key: 'dark', name: '黑底黄字', bg: '#16150F', text: '#FAC775', sub: '#BA7517', img: '#2C2C2A' },
    cream: { key: 'cream', name: '米黄底棕字', bg: '#FBF3E2', text: '#412402', sub: '#854F0B', img: '#F1EFE8' }
  };

  var S = { guides: [], mode: 'read' };
  var U = {
    gid: null, idx: 0, sid: null, tool: 'ellipse', color: '#E24B4A', perPage: 1,
    draft: null, dirty: false, audioNew: [], audioTrash: []
  };

  var IC = {
    edit: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    copy: '<svg class="ic" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15 5H6a1 1 0 0 0-1 1v9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    del: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    up: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 10l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cam: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    gal: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="10" r="1.6" fill="currentColor"/><path d="M4 17l4.5-4.5 3 3L15 12l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    mic: '<svg class="ic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3M9 20h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    play: '<svg class="ic" viewBox="0 0 24 24"><path d="M8 5.5l10 6.5-10 6.5z" fill="currentColor"/></svg>',
    stop: '<svg class="ic" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>',
    redo: '<svg class="ic" viewBox="0 0 24 24"><path d="M8 8H5V5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 8.5a7 7 0 1 1 .5 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    sound: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 9.2h3.2L10 6v12l-3.8-3.2H3z" fill="currentColor"/><path d="M13.6 8.8a4 4 0 0 1 0 6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  function uid() { return Math.random().toString(36).slice(2, 9); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }

  /* ================= 存取 ================= */
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ guides: S.guides })); }
    catch (e) { toast('手机存储空间不太够了，试试删掉几张照片'); }
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var d = JSON.parse(raw); if (d && d.guides) { S.guides = d.guides; return; } }
    } catch (e) { }
    S.guides = seed(); save();
  }
  function getG(id) { for (var i = 0; i < S.guides.length; i++) if (S.guides[i].id === id) return S.guides[i]; return S.guides[0]; }

  /* ---- 编辑草稿：进了某份说明书之后，所有改动先落在草稿上，点了「保存」才算数 ---- */
  function wg() { return U.draft || getG(U.gid); }
  function markDirty() {
    if (!U.draft) return;
    U.dirty = true;
    var b = $('#save-btn'), t = $('#save-txt'), p = $('#save-tip');
    if (b) { b.className = 'btn btn-huge btn-primary btn-save-on'; b.removeAttribute('disabled'); }
    if (t) t.textContent = '保存修改';
    if (p) { p.className = 'save-tip is-warn'; p.textContent = '有改动还没保存。现在退出的话，这次改的都不算。'; }
  }
  function saveDraft() {
    if (!U.draft) return;
    var i, gi = -1;
    for (i = 0; i < S.guides.length; i++) if (S.guides[i].id === U.draft.id) gi = i;
    if (gi < 0) { S.guides.unshift(U.draft); gi = 0; }
    U.draft.updatedAt = Date.now();
    S.guides[gi] = U.draft;
    save();
    for (i = 0; i < U.audioTrash.length; i++) auDel(U.audioTrash[i]);
    U.audioTrash = []; U.audioNew = [];
    U.draft = JSON.parse(JSON.stringify(U.draft));
    U.dirty = false;
    toast('保存好了');
  }
  function dropDraft() {
    for (var i = 0; i < U.audioNew.length; i++) auDel(U.audioNew[i]);
    U.audioNew = []; U.audioTrash = [];
    U.draft = null; U.dirty = false;
  }
  function leaveSteps() {
    if (U.draft && U.dirty) { openSheet('#sheet-unsaved'); return; }
    dropDraft(); renderHome(); show('view-home');
  }
  function getStep(gid, sid) {
    var g = U.draft || getG(gid), i;
    for (i = 0; i < g.steps.length; i++) if (g.steps[i].id === sid) return g.steps[i];
    return g.steps[0];
  }

  /* ================= 录音存取 =================
     录音体积比图片大，单独存放，不挤进说明书的 JSON 里。
     优先 IndexedDB → 其次 localStorage → 最后只放内存。 */
  var AU = { mem: {} };
  function auPut(key, val, cb) {
    AU.mem[key] = val;
    var ok = true;
    try { localStorage.setItem('webook.a.' + key, val); }
    catch (e) { ok = false; }
    cb(ok);
  }
  function auGet(key, cb) {
    if (AU.mem[key]) { cb(AU.mem[key]); return; }
    var v = null;
    try { v = localStorage.getItem('webook.a.' + key); } catch (e) { }
    if (v) AU.mem[key] = v;
    cb(v);
  }
  function auDel(key) {
    delete AU.mem[key];
    try { localStorage.removeItem('webook.a.' + key); } catch (e) { }
  }

  /* ================= 图片 ================= */
  var imgs = new Map();
  function loadImg(src, cb) {
    if (!src) { cb(null); return; }
    var im = imgs.get(src);
    if (im && im.complete && im.naturalWidth) { cb(im); return; }
    im = new Image();
    imgs.set(src, im);
    im.onload = function () { cb(im); };
    im.onerror = function () { cb(null); };
    im.src = src;
  }
  function loadAll(steps, cb) {
    var list = steps.filter(function (s) { return s.img; });
    var n = list.length;
    if (!n) { cb(); return; }
    list.forEach(function (s) {
      loadImg(s.img, function () { if (--n === 0) cb(); });
    });
  }
  function fileToData(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1400 / Math.max(im.width, im.height));
        var w = Math.round(im.width * k), h = Math.round(im.height * k);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(im, 0, 0, w, h);
        cb(c.toDataURL('image/jpeg', 0.72));
      };
      im.onerror = function () { cb(fr.result); };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* ================= 画布绘制 ================= */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawCover(ctx, im, dx, dy, dw, dh) {
    var s = Math.max(dw / im.width, dh / im.height);
    var w2 = im.width * s, h2 = im.height * s;
    ctx.drawImage(im, dx + (dw - w2) / 2, dy + (dh - h2) / 2, w2, h2);
  }
  /* 画「这一步的照片」：
     fit='contain' → 整张照片完整放进去，两边留底色（不裁掉任何内容）
     否则          → 按裁切参数（z 缩放倍数、ox/oy 画面中心）铺满图片区
     z 缺省为 1，等价于老版本的「裁中间」，所以旧数据不会变样。 */
  function drawShot(ctx, im, dx, dy, dw, dh, step, bg) {
    ctx.save();
    ctx.beginPath(); ctx.rect(dx, dy, dw, dh); ctx.clip();
    ctx.fillStyle = bg || '#F1EFE8'; ctx.fillRect(dx, dy, dw, dh);
    var ia = im.naturalWidth / im.naturalHeight;
    var w2, h2, l, t;
    if (step && step.fit === 'contain') {
      var s1 = Math.min(dw / im.naturalWidth, dh / im.naturalHeight);
      w2 = im.naturalWidth * s1; h2 = im.naturalHeight * s1;
      l = dx + (dw - w2) / 2; t = dy + (dh - h2) / 2;
    } else {
      var z = (step && step.z) ? step.z : 1;
      var ox = (step && step.ox != null) ? step.ox : 0.5;
      var oy = (step && step.oy != null) ? step.oy : 0.5;
      var bw = Math.max(dw, dh * ia) * z; h2 = bw / ia; w2 = bw;
      l = dx + dw / 2 - ox * w2; t = dy + dh / 2 - oy * h2;
    }
    ctx.drawImage(im, l, t, w2, h2);
    ctx.restore();
  }
  function drawStrokes(ctx, list, w, h) {
    if (!list || !list.length) return;
    var lw = Math.max(2, w * 0.010);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      ctx.strokeStyle = o.c; ctx.fillStyle = o.c; ctx.lineWidth = lw;
      if (o.t === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(o.cx * w, o.cy * h, o.rx * w, o.ry * h, 0, 0, 6.2832);
        ctx.stroke();
      } else if (o.t === 'arrow') {
        var x1 = o.x1 * w, y1 = o.y1 * h, x2 = o.x2 * w, y2 = o.y2 * h;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        var a = Math.atan2(y2 - y1, x2 - x1), hl = Math.max(8, w * 0.028);
        ctx.beginPath();
        ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl * Math.cos(a - 0.42), y2 - hl * Math.sin(a - 0.42));
        ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl * Math.cos(a + 0.42), y2 - hl * Math.sin(a + 0.42));
        ctx.stroke();
      } else if (o.t === 'free') {
        ctx.beginPath();
        for (var k = 0; k < o.p.length; k++) {
          if (k) ctx.lineTo(o.p[k].x * w, o.p[k].y * h); else ctx.moveTo(o.p[k].x * w, o.p[k].y * h);
        }
        ctx.stroke();
      } else if (o.t === 'number') {
        var x = o.x * w, y = o.y * h, r = Math.max(10, w * 0.045);
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '500 ' + (r * 1.2) + 'px ' + FS;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(o.n), x, y + 1);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
    }
  }
  function wrapText(ctx, text, maxW) {
    var out = [], cur = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (cur && ctx.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }
  function drawSpeaker(ctx, x, y, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.06, y + s * 0.36);
    ctx.lineTo(x + s * 0.30, y + s * 0.36);
    ctx.lineTo(x + s * 0.54, y + s * 0.12);
    ctx.lineTo(x + s * 0.54, y + s * 0.88);
    ctx.lineTo(x + s * 0.30, y + s * 0.64);
    ctx.lineTo(x + s * 0.06, y + s * 0.64);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.2, s * 0.10); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x + s * 0.54, y + s * 0.5, s * 0.20, -Math.PI / 3.2, Math.PI / 3.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + s * 0.54, y + s * 0.5, s * 0.37, -Math.PI / 3.4, Math.PI / 3.4); ctx.stroke();
    ctx.restore();
  }
  function drawCard(ctx, step, g, w, idx, opts) {
    opts = opts || {};
    var th = THEMES[g.theme] || THEMES.white;
    var s = w / CW, ih = IMGH * s, h = CH * s;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, ih); ctx.clip();
    ctx.fillStyle = th.img; ctx.fillRect(0, 0, w, ih);
    var im = imgs.get(step.img);
    if (im && im.complete && im.naturalWidth) drawShot(ctx, im, 0, 0, w, ih, step, th.img);
    drawStrokes(ctx, step.strokes, w, ih);
    ctx.restore();

    var pad = w * 0.055;
    var fs = FONT_BASE[g.font == null ? 3 : g.font] * s;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = th.sub;
    ctx.font = '500 ' + (fs * 0.42) + 'px ' + FS;
    ctx.fillText('第 ' + (idx + 1) + ' 步', pad, ih + fs * 0.95);
    /* 有录音时，卡片上挂一个「可以听录音」的牌子（打印时不需要） */
    if (step.audio && !opts.print) {
      var bs = fs * 0.50;
      ctx.font = '500 ' + (fs * 0.34) + 'px ' + FS;
      var label = '可以听录音';
      var tw = ctx.measureText(label).width;
      var ph = fs * 0.64, pw = fs * 0.16 + bs * 1.28 + fs * 0.14 + tw + fs * 0.22;
      var px = w - pad - pw, py = ih + fs * 0.95 - ph * 0.80;
      ctx.fillStyle = th.text; rr(ctx, px, py, pw, ph, ph / 2); ctx.fill();
      ctx.fillStyle = th.bg;
      drawSpeaker(ctx, px + fs * 0.16, py + ph * 0.24, bs, th.bg);
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px + fs * 0.16 + bs * 1.30, py + ph * 0.54);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.fillStyle = th.text;
    ctx.font = '500 ' + fs + 'px ' + FS;
    var lines = wrapText(ctx, (step.text || '').trim() || '这一步还没写字', w - pad * 2, fs);
    var n = Math.min(2, lines.length);
    var lineH = fs * 1.42;
    var blockH = fs + (n - 1) * lineH;
    var areaTop = ih + fs * 0.95;
    var areaBot = h - fs * 0.5;
    var ty = areaTop + Math.max(fs * 0.2, (areaBot - areaTop - blockH) / 2) + fs * 0.75;
    for (var i = 0; i < n; i++) { ctx.fillText(lines[i], pad, ty); ty += lineH; }
    return h;
  }

  /* ================= 演示数据 ================= */
  function demoImg(seed) {
    var c = document.createElement('canvas'); c.width = 1200; c.height = 720;
    var x = c.getContext('2d');
    x.fillStyle = '#E8E4DC'; x.fillRect(0, 0, 1200, 720);
    var pw = 420, ph = 660, px = 390, py = 30;
    x.fillStyle = '#FFFFFF'; rr(x, px, py, pw, ph, 44); x.fill();
    x.strokeStyle = '#D3D1C7'; x.lineWidth = 2; rr(x, px, py, pw, ph, 44); x.stroke();
    var cols = 4, size = 76, gapx = (pw - cols * size) / 5, gapy = 26;
    var sx = px + gapx, sy = py + 60;
    for (var r = 0; r < 5; r++) for (var ci = 0; ci < cols; ci++) {
      var ix = sx + ci * (size + gapx), iy = sy + r * (size + gapy);
      x.fillStyle = (r * cols + ci) === seed ? '#1D9E75' : '#D3D1C7';
      rr(x, ix, iy, size, size, 18); x.fill();
    }
    return c.toDataURL('image/jpeg', 0.72);
  }
  function demoMark(seed) {
    var ci = seed % 4, r = Math.floor(seed / 4);
    var X = 390 + 23.2 + ci * 99.2 + 38, Y = 90 + r * 102 + 38;
    return { x: X / 1200, y: Y / 720 };
  }
  function seed() {
    var g = {
      id: uid(), title: '和孙子视频通话', color: COVER_COLORS[0], font: 3, theme: 'white',
      lastIndex: 0, updatedAt: Date.now(), steps: []
    };
    [{ s: 5, t: '点亮屏幕，找到绿色的微信' },
     { s: 9, t: '点开微信，找到要通话的人' },
     { s: 17, t: '点右下角的加号，再点视频通话' }].forEach(function (o) {
      var p = demoMark(o.s);
      g.steps.push({
        id: uid(), img: demoImg(o.s), text: o.t,
        strokes: [{ t: 'ellipse', cx: p.x, cy: p.y, rx: 0.05, ry: 0.083, c: '#E24B4A' }]
      });
    });
    return [g];
  }

  /* ================= 通用 UI ================= */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function show(id) {
    stopPlay();
    if (id !== 'view-annotate') recAbort();
    $$('.view').forEach(function (v) { v.classList.toggle('on', v.id === id); });
    window.scrollTo(0, 0);
  }
  function openSheet(id) { $('#mask').hidden = false; $(id).hidden = false; }
  function closeSheet() {
    $('#mask').hidden = true;
    ['#sheet-confirm', '#sheet-style', '#sheet-export', '#sheet-unsaved'].forEach(function (i) { $(i).hidden = true; });
  }
  function fmt(ts) {
    var d = new Date(ts), n = new Date();
    if (d.toDateString() === n.toDateString()) return '今天';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /* ================= 首页 ================= */
  function renderHome() {
    var edit = S.mode === 'edit';
    $('#home-tag').textContent = edit ? '创作模式' : '阅读模式';
    $('#home-bar').classList.toggle('bar-edit', edit);
    $('#lp-btn').hidden = edit;
    $('#btn-exit').hidden = !edit;
    $('#btn-new').hidden = !edit;
    var list = $('#home-list');
    list.innerHTML = '';
    if (!S.guides.length) {
      list.innerHTML = '<div class="empty"><h3>还没有说明书</h3><p>' +
        (edit ? '点最下面的「新建说明书」，<br>先起个老人听得懂的名字。' :
                '长按右上角「创作」三秒，<br>就可以开始做说明书了。') +
        '</p></div>';
      return;
    }
    S.guides.forEach(function (g) {
      var el = document.createElement('div');
      el.className = 'gcard';
      /* 封面用「第一步的照片」——老人认图比认字快，
         一眼就知道这份是教什么的。没有步骤时才退回用名字第一个字。 */
      var fst = g.steps[0];
      var cover = (fst && fst.img)
        ? '<img class="gcover-img" src="' + fst.img + '" alt="">'
        : '<span class="gcover-ph">' + esc((g.title || '书').slice(0, 1)) + '</span>';
      var html = '<div class="gcover" style="background:' + (g.color || COVER_COLORS[0]) + '">' +
        cover + '<span class="gcover-n">' + g.steps.length + ' 步</span></div><div class="gmain">' +
        '<p class="gname">' + esc(g.title) + '</p>' +
        '<p class="gsub">更新于 ' + fmt(g.updatedAt) + '</p>';
      if (edit) {
        html += '<div class="gedit">' +
          '<button class="btn" data-act="edit">' + IC.edit + '编辑步骤</button>' +
          '<button class="btn" data-act="copy">' + IC.copy + '复制一份</button>' +
          '<button class="btn btn-danger" data-act="del">' + IC.del + '删除</button>' +
          '</div>';
      }
      html += '</div>';
      el.innerHTML = html;
      el.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (b) {
          var act = b.getAttribute('data-act');
          if (act === 'edit') { openSteps(g.id); return; }
          if (act === 'copy') {
            var ng = JSON.parse(JSON.stringify(g));
            ng.id = uid(); ng.title = g.title + '（副本）';
            ng.steps.forEach(function (s) { s.id = uid(); });
            ng.updatedAt = Date.now();
            S.guides.splice(S.guides.indexOf(g) + 1, 0, ng);
            save(); renderHome(); toast('复制好了');
            return;
          }
          if (act === 'del') {
            if (confirm('确定删除《' + g.title + '》吗？删掉就找不回来了。')) {
              S.guides.splice(S.guides.indexOf(g), 1); save(); renderHome();
            }
            return;
          }
        }
        if (edit) openSteps(g.id); else openRead(g.id);
      });
      list.appendChild(el);
    });
  }

  /* ================= 创作：步骤列表 ================= */
  function openSteps(gid) {
    U.gid = gid;
    U.draft = JSON.parse(JSON.stringify(getG(gid)));
    U.dirty = false; U.audioNew = []; U.audioTrash = [];
    show('view-steps'); renderSteps();
  }
  function renderSaveBar() {
    var list = $('#steps-list');
    var sb = document.createElement('div');
    sb.className = 'savebar';
    sb.innerHTML =
      '<button class="btn btn-huge ' + (U.dirty ? 'btn-primary btn-save-on' : 'btn-save-idle') + '" id="save-btn" type="button">' +
      '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M5 4h11l3 3v13H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M9 4v5h6V4M8 20v-6h8v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
      '</svg><span id="save-txt">' + (U.dirty ? '保存修改' : '保存') + '</span></button>' +
      '<p class="save-tip' + (U.dirty ? ' is-warn' : '') + '" id="save-tip">' +
      (U.dirty ? '有改动还没保存。现在退出的话，这次改的都不算。' : '已经存好了。改完步骤记得再点一次「保存」。') +
      '</p>';
    list.appendChild(sb);
    $('#save-btn').addEventListener('click', function () {
      saveDraft(); renderSteps();
    });
  }
  function renderSteps() {
    var g = wg();
    $('#steps-title').textContent = g.title;
    var list = $('#steps-list');
    list.innerHTML = '';
    renderSaveBar();
    if (!g.steps.length) {
      var em = document.createElement('div');
      em.className = 'empty';
      em.innerHTML = '<h3>还没有步骤</h3><p>先拍一张照片，<br>再用手指在照片上画个红圈。</p>';
      list.appendChild(em);
    }
    g.steps.forEach(function (s, i) {
      var el = document.createElement('div');
      el.className = 'scard';
      el.innerHTML =
        '<img class="sthumb" src="' + s.img + '" alt="第 ' + (i + 1) + ' 步">' +
        '<div class="smain">' +
        '<p class="stext">第 ' + (i + 1) + ' 步　' + esc(s.text || '（还没写字）') + '</p>' +
        (s.audio ? '<span class="sa-hasrec">' + IC.sound + '已录了语音</span>' : '') +
        '<div class="sact">' +
        '<button class="btn btn-ok btn-editstep" data-a="edit">' + IC.edit + '修改</button>' +
        '<button class="btn" data-a="up"' + (i === 0 ? ' disabled' : '') + '>' + IC.up + '上移</button>' +
        '<button class="btn" data-a="down"' + (i === g.steps.length - 1 ? ' disabled' : '') + '>' + IC.down + '下移</button>' +
        '<button class="btn btn-danger" data-a="del">' + IC.del + '删除</button>' +
        '</div></div>';
      el.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (b) {
          var a = b.getAttribute('data-a');
          if (a === 'edit') { openAnnotate(s.id); return; }
          if (a === 'up' && i > 0) { g.steps.splice(i - 1, 0, g.steps.splice(i, 1)[0]); g.updatedAt = Date.now(); markDirty(); renderSteps(); return; }
          if (a === 'down' && i < g.steps.length - 1) { g.steps.splice(i + 1, 0, g.steps.splice(i, 1)[0]); g.updatedAt = Date.now(); markDirty(); renderSteps(); return; }
          if (a === 'del') {
            if (confirm('删掉第 ' + (i + 1) + ' 步吗？照片和录音一起删，找不回来了。')) {
              if (s.audio) U.audioTrash.push(s.audio);
              g.steps.splice(i, 1); g.updatedAt = Date.now(); markDirty(); renderSteps();
            }
            return;
          }
        } else {
          openAnnotate(s.id);
        }
      });
      list.appendChild(el);
    });
    var add = document.createElement('div');
    add.className = 'addrow';
    add.innerHTML = '<button class="btn btn-huge btn-primary" id="add-cam">' + IC.cam + '拍一张照片</button>' +
      '<button class="btn btn-huge" id="add-gal">' + IC.gal + '从相册选图</button>';
    list.appendChild(add);
    $('#add-cam').addEventListener('click', function () { $('#file-camera').click(); });
    $('#add-gal').addEventListener('click', function () { $('#file-gallery').click(); });
  }
  function addStepFromFile(file) {
    if (!file) return;
    toast('正在处理照片…');
    fileToData(file, function (url) {
      var g = wg();
      var st = { id: uid(), img: url, strokes: [], text: '' };
      g.steps.push(st); g.updatedAt = Date.now(); markDirty();
      /* 先让他调整照片大小位置（或直接选「完整显示」），再进标注 */
      openCrop(st.id);
    });
  }

  /* ================= 创作：单步标注 ================= */
  function openAnnotate(sid) {
    U.sid = sid;
    var g = wg(), st = getStep(U.gid, sid);
    var i = g.steps.indexOf(st);
    $('#ann-title').textContent = '第 ' + (i + 1) + ' 步 · 修改';
    $('#ann-text').value = st.text || '';
    updateHint();
    show('view-annotate');
    renderRec();
    loadImg(st.img, function () { renderAnn(); });
  }
  function renderAnn() {
    var g = wg(), st = getStep(U.gid, U.sid);
    var c = $('#ann-canvas');
    var w = c.getBoundingClientRect().width || 340;
    var ih = w * IMGH / CW;
    c.width = Math.round(w * 2); c.height = Math.round(ih * 2);
    c.style.height = ih + 'px';
    var ctx = c.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    var th = THEMES[g.theme] || THEMES.white;
    ctx.fillStyle = th.img; ctx.fillRect(0, 0, w, ih);
    var im = imgs.get(st.img);
    if (im && im.complete && im.naturalWidth) drawShot(ctx, im, 0, 0, w, ih, st, th.img);
    drawStrokes(ctx, st.strokes, w, ih);
  }
  function updateHint() {
    var n = $('#ann-text').value.trim().length;
    var h = $('#ann-hint');
    if (n === 0) { h.className = 'hint'; h.textContent = '还没写字，建议 30 字以内，老人看得就不累。'; }
    else if (n <= 30) { h.className = 'hint'; h.textContent = '已写 ' + n + ' 字，很好，短句最有效。'; }
    else { h.className = 'hint warn'; h.textContent = '已写 ' + n + ' 字，太长了。试试拆成两步？'; }
  }
  /* ================= 录音（方言旁白） ================= */
  var R = { mr: null, chunks: [], stream: null, t0: 0, timer: null, state: 'idle', dur: 0, busy: false };
  var player = null, playerBtn = null, playerLabel = null, playerIdle = '';

  function recSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }
  function pickMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    var list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/aac'];
    for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported(list[i])) return list[i];
    return '';
  }
  function fmtSec(n) { return (n < 60 ? n + ' 秒' : Math.floor(n / 60) + ' 分' + (n % 60) + ' 秒'); }

  function stopPlay() {
    if (player) { try { player.pause(); player.currentTime = 0; } catch (e) { } player = null; }
    if (playerBtn) { playerBtn.classList.remove('is-playing'); playerBtn = null; }
    if (playerLabel) { playerLabel.innerHTML = playerIdle; playerLabel = null; }
  }
  function playClip(key, btn, labelEl, idleHTML) {
    if (player && playerBtn === btn) { stopPlay(); return; }
    stopPlay();
    auGet(key, function (url) {
      if (!url) { toast('这段录音找不到了，重新录一次吧'); return; }
      try { player = new Audio(url); }
      catch (e) { toast('这台设备放不了这段录音'); return; }
      playerBtn = btn;
      if (labelEl) { playerLabel = labelEl; playerIdle = idleHTML || labelEl.innerHTML; labelEl.innerHTML = '正在播放…<em>再点一下就停</em>'; }
      btn.classList.add('is-playing');
      player.onended = stopPlay;
      player.onerror = function () { toast('播放失败了'); stopPlay(); };
      var p = player.play();
      if (p && p.catch) p.catch(function () { toast('播放失败了'); stopPlay(); });
    });
  }

  function renderRec() {
    var box = $('#rec-body');
    if (!box) return;
    var st = getStep(U.gid, U.sid);
    var tip = $('#rec-tip');
    if (tip) tip.hidden = !!(st && st.audio) || R.state === 'rec';
    if (R.state === 'rec') {
      box.innerHTML =
        '<button class="btn btn-huge btn-rec is-live" id="rec-stop" type="button">' + IC.stop + '说完了，点这里停</button>' +
        '<div class="rec-status"><span class="rec-dot live"></span>正在录音…<span class="rec-time" id="rec-time">0 秒</span></div>';
      $('#rec-stop').addEventListener('click', stopRec);
      return;
    }
    if (st && st.audio) {
      box.innerHTML =
        '<div class="rec-status"><span class="rec-dot ok"></span>' +
        (st.audioLen ? '已录好，' + fmtSec(st.audioLen) : '已录好') +
        '。老人点「听家里人说的」就能听到。</div>' +
        '<div class="rec-acts">' +
        '<button class="btn btn-rec" id="rec-play" type="button">' + IC.play + '试听</button>' +
        '<button class="btn" id="rec-redo" type="button">' + IC.redo + '重录</button>' +
        '<button class="btn btn-danger" id="rec-del" type="button">' + IC.del + '删除</button>' +
        '</div>';
      $('#rec-play').addEventListener('click', function () {
        var b = this;
        playClip(st.audio, b, null, null);
      });
      $('#rec-redo').addEventListener('click', function () { startRec(); });
      $('#rec-del').addEventListener('click', function () {
        if (st.audio) U.audioTrash.push(st.audio);
        delete st.audio; delete st.audioLen;
        var g = wg(); g.updatedAt = Date.now();
        markDirty(); renderRec();
      });
      return;
    }
    box.innerHTML =
      '<button class="btn btn-huge btn-rec" id="rec-start" type="button">' + IC.mic + '点一下开始说话</button>' +
      (recSupported() ? '' : '<div class="rec-status">在手机浏览器里可能录不了，装成 App 后就能录。</div>');
    $('#rec-start').addEventListener('click', startRec);
  }

  function startRec() {
    if (!recSupported()) { toast('这里录不了音，装成手机 App 后就可以了'); return; }
    if (R.busy) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      stopPlay();
      R.stream = stream; R.chunks = []; R.state = 'rec'; R.t0 = Date.now(); R.dur = 0; R.busy = false;
      var mime = pickMime();
      try {
        R.mr = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 24000 })
                    : new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
      } catch (e) {
        try { R.mr = new MediaRecorder(stream); }
        catch (e2) { R.state = 'idle'; toast('录音启动失败了'); return; }
      }
      R.mr.ondataavailable = function (e) { if (e.data && e.data.size) R.chunks.push(e.data); };
      R.mr.onstop = finishRec;
      R.mr.start();
      renderRec();
      R.timer = setInterval(function () {
        R.dur = Math.round((Date.now() - R.t0) / 1000);
        var t = $('#rec-time'); if (t) t.textContent = fmtSec(R.dur);
        if (R.dur >= 120) stopRec();
      }, 250);
    }).catch(function () {
      toast('没拿到麦克风权限，去手机设置里允许一下');
    });
  }
  function stopRec() {
    clearInterval(R.timer); R.timer = null;
    try { if (R.mr && R.mr.state !== 'inactive') R.mr.stop(); }
    catch (e) { finishRec(); }
    if (R.stream) {
      try { R.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
      R.stream = null;
    }
  }
  function finishRec() {
    if (R.busy) return;
    R.busy = true;
    var st = getStep(U.gid, U.sid);
    var dur = R.dur;
    var type = (R.mr && R.mr.mimeType) || 'audio/webm';
    var blob = new Blob(R.chunks, { type: type });
    R.state = 'idle';
    if (!blob.size) { R.busy = false; renderRec(); toast('没录到声音，再试一次'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var key = st.audio || uid();
      auPut(key, fr.result, function (ok) {
        if (!st.audio) U.audioNew.push(key);
        st.audio = key; st.audioLen = dur;
        var g = wg(); g.updatedAt = Date.now();
        markDirty();
        R.busy = false; R.dur = dur;
        renderRec();
        toast(ok ? ('录好了，' + fmtSec(dur)) : ('录好了 ' + fmtSec(dur) + '，但手机空间紧，重启后可能丢'));
      });
    };
    fr.onerror = function () { R.busy = false; renderRec(); toast('录音保存失败了'); };
    fr.readAsDataURL(blob);
  }
  function recAbort() {
    if (R.state === 'rec') { stopRec(); }
    R.state = 'idle'; R.dur = 0;
    stopPlay();
  }

  var draw = null;
  function annPos(c, e) {
    var r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  /* ================= 创作：调整照片（裁切 / 缩放 / 完整显示） ================= */
  var C = { sid: null, src: '', z: 1, ox: 0.5, oy: 0.5, contain: false, bw: 0, bh: 0 };
  function cropStore() {
    var st = getStep(U.gid, C.sid);
    if (!st) return;
    st.fit = C.contain ? 'contain' : 'cover';
    st.z = C.z; st.ox = C.ox; st.oy = C.oy;
    markDirty();
  }
  function openCrop(sid) {
    var st = getStep(U.gid, sid);
    if (!st || !st.img) { openAnnotate(sid); return; }
    C.sid = sid; C.src = st.img;
    C.contain = st.fit === 'contain';
    C.z = st.z || 1;
    C.ox = (st.ox == null) ? 0.5 : st.ox;
    C.oy = (st.oy == null) ? 0.5 : st.oy;
    show('view-crop');
    loadImg(C.src, function () { cropLayout(); });
  }
  function cropLayout() {
    var stage = $('#crop-stage');
    var SW = stage.clientWidth;
    if (!SW) return;
    var SH = Math.round(SW * IMGH / CW);
    stage.style.height = SH + 'px';
    var im = imgs.get(C.src);
    var el = $('#crop-img');
    if (el.getAttribute('src') !== C.src) el.setAttribute('src', C.src);
    var fitBtn = $('#crop-fit');
    if (fitBtn) {
      fitBtn.classList.toggle('is-on', C.contain);
      $('#crop-fit-txt').textContent = C.contain
        ? '整张照片都显示出来了（点一下改回铺满）'
        : '完整显示整张照片（不裁掉任何内容）';
    }
    stage.style.background = C.contain ? '#F1EFE8' : '#E4E2DB';
    if (!im || !im.naturalWidth) return;
    var ia = im.naturalWidth / im.naturalHeight;
    var bw, bh;
    if (C.contain) { bw = Math.min(SW, SH * ia); bh = bw / ia; }
    else { bw = Math.max(SW, SH * ia) * C.z; bh = bw / ia; }
    var L = SW / 2 - C.ox * bw, T = SH / 2 - C.oy * bh;
    if (bw > SW) { L = Math.min(0, Math.max(SW - bw, L)); C.ox = (SW / 2 - L) / bw; }
    else { L = (SW - bw) / 2; }
    if (bh > SH) { T = Math.min(0, Math.max(SH - bh, T)); C.oy = (SH / 2 - T) / bh; }
    else { T = (SH - bh) / 2; }
    C.bw = bw; C.bh = bh;
    el.style.width = Math.round(bw) + 'px';
    el.style.height = Math.round(bh) + 'px';
    el.style.transform = 'translate(' + Math.round(L) + 'px,' + Math.round(T) + 'px)';
  }
  function cropZoom(mul) {
    C.contain = false;
    C.z = Math.min(5, Math.max(1, C.z * mul));
    cropLayout(); cropStore();
  }
  function cropDone() { cropStore(); openAnnotate(C.sid); }
  var CP = new Map(), cDist = 0;
  function cropDist() {
    var a = null, b = null;
    CP.forEach(function (v) { if (!a) a = v; else if (!b) b = v; });
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function cropMid() {
    var a = null, b = null;
    CP.forEach(function (v) { if (!a) a = v; else if (!b) b = v; });
    if (!a || !b) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  function cropBind() {
    var stage = $('#crop-stage');
    stage.addEventListener('pointerdown', function (e) {
      CP.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (CP.size === 2) cDist = cropDist();
      try { stage.setPointerCapture(e.pointerId); } catch (err) { }
    });
    stage.addEventListener('pointermove', function (e) {
      var prev = CP.get(e.pointerId);
      if (!prev) return;
      var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      CP.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (CP.size >= 2) {
        var d = cropDist();
        if (cDist > 0 && d > 0) {
          C.contain = false;
          C.z = Math.min(5, Math.max(1, C.z * (d / cDist)));
          cDist = d;
          cropLayout();
        }
        return;
      }
      if (C.bw) C.ox -= dx / C.bw;
      if (C.bh) C.oy -= dy / C.bh;
      cropLayout();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      stage.addEventListener(ev, function (e) {
        CP.delete(e.pointerId);
        if (CP.size < 2) cDist = 0;
        cropStore();
      });
    });
    $('#crop-zoom-in').addEventListener('click', function () { cropZoom(1.2); });
    $('#crop-zoom-out').addEventListener('click', function () { cropZoom(1 / 1.2); });
    $('#crop-fit').addEventListener('click', function () {
      C.contain = !C.contain;
      if (C.contain) { C.z = 1; }
      cropLayout(); cropStore();
      toast(C.contain ? '整张照片都放进去了，两边会留一点底色' : '改回铺满，超出的部分会被裁掉');
    });
    $('#crop-back').addEventListener('click', cropDone);
    $('#crop-ok').addEventListener('click', cropDone);
    $('#crop-done').addEventListener('click', cropDone);
    $('#crop-repick').addEventListener('click', function () { $('#file-crop').click(); });
    $('#file-crop').addEventListener('change', function () {
      var f = this.files[0], self = this;
      if (!f) return;
      toast('正在处理照片…');
      fileToData(f, function (url) {
        var st = getStep(U.gid, C.sid);
        st.img = url; st.strokes = [];
        C.src = url; C.z = 1; C.ox = 0.5; C.oy = 0.5; C.contain = false;
        markDirty();
        loadImg(url, function () { cropLayout(); });
        self.value = '';
      });
    });
  }

  /* ================= 阅读：点图片放大看 ================= */
  var Z = { s: 1, x: 0, y: 0 };
  function applyZoom() {
    var p = $('#zoom-pan');
    p.style.transform = 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.s + ')';
  }
  function openZoom() {
    var g = getG(U.gid), st = g.steps[U.idx];
    if (!st || !st.img) return;
    loadImg(st.img, function (im) {
      if (!im || !im.naturalWidth) { toast('这张照片打不开'); return; }
      var W = Math.min(1600, Math.max(900, im.naturalWidth));
      var c = $('#zoom-canvas');
      c.width = W; c.height = Math.round(W * IMGH / CW);
      var x = c.getContext('2d');
      var th = THEMES[g.theme] || THEMES.white;
      drawShot(x, im, 0, 0, c.width, c.height, st, th.img);
      drawStrokes(x, st.strokes, c.width, c.height);
      Z.s = 1; Z.x = 0; Z.y = 0; applyZoom();
      $('#zoom-n').textContent = '第 ' + (U.idx + 1) + ' 步';
      $('#zoom').hidden = false;
    });
  }
  function closeZoom() { $('#zoom').hidden = true; }
  var ZP = new Map(), zDist = 0;
  function zoomBind() {
    $('#read-canvas').addEventListener('click', function (e) {
      var r = this.getBoundingClientRect();
      if (!r.height) return;
      var fy = (e.clientY - r.top) / r.height;
      if (fy <= IMGH / CH + 0.02) openZoom();
    });
    var stage = $('#zoom-stage');
    stage.addEventListener('pointerdown', function (e) {
      ZP.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ZP.size === 2) zDist = Math.hypot(
        (function () { var a = []; ZP.forEach(function (v) { a.push(v); }); return a[0].x - a[1].x; })(),
        (function () { var a = []; ZP.forEach(function (v) { a.push(v); }); return a[0].y - a[1].y; })());
      try { stage.setPointerCapture(e.pointerId); } catch (err) { }
    });
    stage.addEventListener('pointermove', function (e) {
      var prev = ZP.get(e.pointerId);
      if (!prev) return;
      var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      ZP.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ZP.size >= 2) {
        var a = []; ZP.forEach(function (v) { a.push(v); });
        var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (zDist > 0 && d > 0) { Z.s = Math.min(4, Math.max(1, Z.s * (d / zDist))); zDist = d; applyZoom(); }
        return;
      }
      var lim = stage.clientHeight * Z.s * 0.6;
      Z.x = Math.max(-lim, Math.min(lim, Z.x + dx));
      Z.y = Math.max(-lim, Math.min(lim, Z.y + dy));
      applyZoom();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      stage.addEventListener(ev, function (e) { ZP.delete(e.pointerId); if (ZP.size < 2) zDist = 0; });
    });
    $('#zoom-in').addEventListener('click', function () { Z.s = Math.min(4, Z.s * 1.35); applyZoom(); });
    $('#zoom-out').addEventListener('click', function () { Z.s = Math.max(1, Z.s / 1.35); if (Z.s === 1) { Z.x = 0; Z.y = 0; } applyZoom(); });
    $('#zoom-reset').addEventListener('click', function () { Z.s = 1; Z.x = 0; Z.y = 0; applyZoom(); });
    $('#zoom-close').addEventListener('click', closeZoom);
    $('#zoom-back').addEventListener('click', closeZoom);
  }

  /* ================= 阅读 ================= */
  function openRead(gid) {
    stopPlay();
    U.gid = gid; U.draft = null;
    var g = getG(gid);
    U.idx = Math.max(0, Math.min(g.lastIndex || 0, g.steps.length - 1));
    show('view-read');
    renderRead();
  }
  function renderRead() {
    stopPlay();
    var g = getG(U.gid);
    var th = THEMES[g.theme] || THEMES.white;
    $('#view-read').style.background = th.bg;
    $('#read-title').textContent = g.title;
    $('#read-count').textContent = '第 ' + (U.idx + 1) + ' / ' + g.steps.length + ' 步';
    $('#read-prev').disabled = U.idx === 0;
    $('#read-next').disabled = U.idx >= g.steps.length - 1;
    /* 两种听法：优先家里的录音，机器朗读兜底 */
    var curSt = g.steps[U.idx];
    var hasAu = !!(curSt && curSt.audio);
    var ra = $('#read-audio'), rs = $('#read-speak');
    ra.hidden = !hasAu;
    rs.classList.toggle('btn-rec-primary', !hasAu);
    $('#read-speak-txt').innerHTML = hasAu ? '机器朗读<em>手机自己念</em>' : '朗读这一步<em>手机念给你听</em>';
    var d = $('#read-dots'); d.innerHTML = '';
    g.steps.forEach(function (s, i) {
      var sp = document.createElement('span');
      if (i === U.idx) sp.className = 'on';
      d.appendChild(sp);
    });
    if (!g.steps.length) {
      var c0 = $('#read-canvas');
      c0.width = 600; c0.height = 300;
      var x0 = c0.getContext('2d');
      x0.fillStyle = th.bg; x0.fillRect(0, 0, 600, 300);
      x0.fillStyle = th.text; x0.font = '500 30px ' + FS;
      x0.fillText('这份说明书还没有步骤', 40, 160);
      return;
    }
    loadAll(g.steps, function () {
      var c = $('#read-canvas');
      /* 卡片尺寸按「可用宽度的比例」算，同时不许把翻页按钮挤出屏幕：
         先按屏宽的 55% 定卡片高度上限，再换算成宽度，取两者里小的那个。 */
      var par = c.parentElement;
      var pcs = window.getComputedStyle ? window.getComputedStyle(par) : null;
      var box = (par.clientWidth || 340) - (pcs ? parseFloat(pcs.paddingLeft || 0) + parseFloat(pcs.paddingRight || 0) : 20);
      var vh = window.innerHeight || document.documentElement.clientHeight || 700;
      var byH = vh * 0.55 * CW / CH;
      var w = Math.max(200, Math.min(box, byH));
      c.style.width = w + 'px';
      c.width = Math.round(w * 2); c.height = Math.round(w * 2 * CH / CW);
      c.style.height = (w * CH / CW) + 'px';
      var ctx = c.getContext('2d');
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      drawCard(ctx, g.steps[U.idx], g, w, U.idx);
    });
  }
  function speak(t) {
    if (!t || !t.trim()) { toast('这一步还没有写文字'); return; }
    if (window.WeBook && window.WeBook.speak) {
      try { window.WeBook.speak(t); return; } catch (e) { }
    }
    if (!('speechSynthesis' in window)) { toast('这台设备不支持朗读'); return; }
    try {
      var u = new SpeechSynthesisUtterance(t);
      u.lang = 'zh-CN'; u.rate = 0.85;
      var vs = speechSynthesis.getVoices().filter(function (v) { return /zh|cmn/i.test(v.lang); });
      if (vs.length) u.voice = vs[0];
      else { toast('这台手机还没装中文语音，去「设置 → 语言和输入」里装一个'); return; }
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { toast('朗读失败了'); }
  }

  /* ================= 导出 ================= */
  function exProg(t) {
    var p = $('#ex-prog');
    if (!p) return;
    p.textContent = t || '';
    p.hidden = !t;
  }
  function exportLongImage(g) {
    var HDR = 150, n = g.steps.length, i = 0;
    var c = document.createElement('canvas');
    c.width = CW; c.height = HDR + n * CH;
    var ctx = c.getContext('2d');
    var th = THEMES[g.theme] || THEMES.white;
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = th.text; ctx.font = '500 56px ' + FS; ctx.textBaseline = 'alphabetic';
    ctx.fillText(g.title, 54, 96);
    ctx.fillStyle = th.sub; ctx.font = '500 26px ' + FS;
    ctx.fillText('共 ' + n + ' 步 · 微书 WeBook', 54, 134);
    exProg('正在拼长图：第 0 / ' + n + ' 步');
    function one() {
      if (i >= n) {
        exProg('正在存到手机…');
        setTimeout(function () {
          download(c.toDataURL('image/jpeg', 0.86), g.title + '（微书）.jpg');
        }, 30);
        return;
      }
      ctx.save(); ctx.translate(0, HDR + i * CH);
      drawCard(ctx, s_of(i), g, CW, i, { print: true });
      ctx.restore();
      i++;
      exProg('正在拼长图：第 ' + i + ' / ' + n + ' 步');
      if (i < n) setTimeout(one, 0); else setTimeout(one, 60);
    }
    function s_of(k) { return g.steps[k]; }
    setTimeout(one, 30);
  }
  function exportPDF(g) {
    var JSPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JSPDF) { toast('PDF 组件没加载出来，先导出长图吧'); finishExport(); return; }
    var per = U.perPage;
    var cw = per === 1 ? 470 : 330;
    var chh = cw * CH / CW;
    var th = THEMES[g.theme] || THEMES.white;
    var hc = document.createElement('canvas');
    hc.width = cw; hc.height = Math.round(cw * 150 / 900);
    var hx = hc.getContext('2d');
    hx.fillStyle = th.bg; hx.fillRect(0, 0, hc.width, hc.height);
    hx.fillStyle = th.text; hx.font = '500 ' + (56 * cw / 900) + 'px ' + FS;
    hx.fillText(g.title, 0, hc.height * 0.64);
    hx.fillStyle = th.sub; hx.font = '500 ' + (26 * cw / 900) + 'px ' + FS;
    hx.fillText('共 ' + g.steps.length + ' 步', 0, hc.height * 0.64 + 44 * cw / 900);

    var pdf = new JSPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    pdf.addImage(hc.toDataURL('image/jpeg', 0.9), 'JPEG', (595.28 - cw) / 2, 44, cw, hc.height);
    var y = 44 + hc.height + 28;
    var n = g.steps.length, i = 0;
    exProg('正在生成 PDF：第 0 / ' + n + ' 页');
    function one() {
      if (i >= n) {
        exProg('正在存到手机…');
        /* 注意：不能用 pdf.save()——那是网页的「下载链接」，在 App 里等于什么都没发生。
           必须取出文件数据交给原生去写。 */
        download(pdf.output('datauristring'), g.title + '（微书）.pdf');
        return;
      }
      if (i > 0 && i % per === 0) { pdf.addPage(); y = per === 1 ? 150 : 90; }
      var cc = document.createElement('canvas');
      cc.width = CW; cc.height = CH;
      var cx = cc.getContext('2d');
      drawCard(cx, g.steps[i], g, CW, i, { print: true });
      pdf.addImage(cc.toDataURL('image/jpeg', 0.9), 'JPEG', (595.28 - cw) / 2, y, cw, chh);
      y += chh + (per === 1 ? 0 : 18);
      i++;
      exProg('正在生成 PDF：第 ' + i + ' / ' + n + ' 页');
      setTimeout(one, 0);
    }
    setTimeout(one, 30);
  }
  function download(url, name) {
    /* 装成手机 App 后，交给原生保存到手机的「下载」目录。
       PDF 动辄好几 MB，整串 base64 一次性穿桥容易被截断，所以切成小块。 */
    if (window.WeBook && window.WeBook.saveBegin) {
      var i = url.indexOf(',');
      if (i > 0) {
        var b64 = url.slice(i + 1);
        if (!window.WeBook.saveBegin(name)) { toast('手机这边开不了文件，试试重启一下微书'); return; }
        var CH = 65536, ok = true, p;
        for (p = 0; p < b64.length; p += CH) {
          if (!window.WeBook.saveChunk(b64.substr(p, CH))) { ok = false; break; }
        }
        if (ok && window.WeBook.saveEnd()) {
          toast('《' + name + '》存好了');
          finishExport();
          return;
        }
        toast('保存失败了，可能手机空间不够');
        finishExport();
        return;
      }
    }
    if (window.WeBook && window.WeBook.saveBase64) {
      var j = url.indexOf(',');
      if (j > 0) {
        var ok2 = window.WeBook.saveBase64(name, url.slice(j + 1));
        toast(ok2 ? ('《' + name + '》存好了') : '保存失败了，可能手机空间不够');
        finishExport();
        return;
      }
    }
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    finishExport();
  }
  function finishExport() {
    exProg('');
    if (U.exDone) { var f = U.exDone; U.exDone = null; f(); }
  }

  /* ================= 已导出的文件 ================= */
  var EXIC = {
    pdf: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 15h12" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    img: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 17l4.5-4.5 3 3L15 12l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    share: '<svg class="ic" viewBox="0 0 24 24"><circle cx="18" cy="5.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="18.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };
  function fmtSize(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }
  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts * 1000), n = new Date();
    var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (d.toDateString() === n.toDateString()) return '今天 ' + hm;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  }
  function renderExportList() {
    var box = $('#ex-list');
    if (!box) return;
    if (!(window.WeBook && window.WeBook.exportList)) { box.hidden = true; return; }
    var arr = [];
    try { arr = JSON.parse(window.WeBook.exportList() || '[]'); } catch (e) { arr = []; }
    if (!arr.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var h = '<div class="seg-label">已经导出的文件</div>' +
      '<p class="exlist-tip">在手机的「文件管理 → 下载 → 微书」里也能找到。点「分享」可以直接发到微信、或者直接发给打印店。</p><div class="exlist">';
    arr.forEach(function (f) {
      var isPdf = /\.pdf$/i.test(f.name);
      h += '<div class="exfile">' +
        '<div class="exfile-ic' + (isPdf ? ' is-pdf' : ' is-img') + '">' + (isPdf ? EXIC.pdf : EXIC.img) + '</div>' +
        '<div class="exfile-main">' +
        '<p class="exfile-name">' + esc(f.name) + '</p>' +
        '<p class="exfile-sub">' + fmtSize(f.size) + ' · ' + fmtTime(f.time) + '</p>' +
        '</div>' +
        '<div class="exfile-act">' +
        '<button class="btn btn-mini btn-primary" data-ex="share" data-name="' + esc(f.name) + '" type="button">' + EXIC.share + '分享</button>' +
        '<button class="btn btn-mini btn-danger" data-ex="del" data-name="' + esc(f.name) + '" type="button">' + IC.del + '删除</button>' +
        '</div></div>';
    });
    h += '</div>';
    box.innerHTML = h;
  }
  function bindExportList() {
    var box = $('#ex-list');
    if (!box || box.dataset.bound) return;
    box.dataset.bound = '1';
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-ex]');
      if (!b) return;
      var name = b.getAttribute('data-name');
      var act = b.getAttribute('data-ex');
      if (act === 'share') {
        if (window.WeBook && window.WeBook.shareFile) { window.WeBook.shareFile(name); }
        else toast('只有在手机 App 里才能分享');
      } else if (act === 'del') {
        if (!confirm('把《' + name + '》从手机上删掉吗？')) return;
        if (window.WeBook && window.WeBook.deleteExport) {
          window.WeBook.deleteExport(name);
          setTimeout(renderExportList, 200);
        }
      }
    });
  }

  /* ================= 弹层 ================= */
  function openStyle() {
    var g = wg();
    var fs = $('#seg-font'); fs.innerHTML = '';
    FONT_LABELS.forEach(function (lab, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-bt' + (g.font === i ? ' is-on' : '');
      b.innerHTML = '<span class="A" style="font-size:' + (12 + i * 4) + 'px">A</span><em>' + lab + '</em>';
      b.addEventListener('click', function () {
        g.font = i; markDirty();
        $$('.seg-bt', fs).forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
      });
      fs.appendChild(b);
    });
    var ts = $('#seg-theme'); ts.innerHTML = '';
    Object.keys(THEMES).forEach(function (k) {
      var t = THEMES[k];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-bt' + (g.theme === k ? ' is-on' : '');
      b.innerHTML = '<span style="width:100%;height:26px;border-radius:5px;background:' + t.bg +
        ';color:' + t.text + ';font-size:13px;display:flex;align-items:center;justify-content:center">照着做</span><em>' + t.name + '</em>';
      b.addEventListener('click', function () {
        g.theme = k; markDirty();
        $$('.seg-bt', ts).forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
      });
      ts.appendChild(b);
    });
    openSheet('#sheet-style');
  }
  function openExport() {
    var g = wg();
    $('#ex-sub').textContent = '《' + g.title + '》共 ' + g.steps.length + ' 步。PDF 是 A4 竖版，打出来就能贴在墙上。';
    var na = g.steps.filter(function (s) { return s.audio; }).length;
    var note = $('#ex-audionote');
    note.hidden = !na;
    note.textContent = '这份说明书里有 ' + na + ' 步录了语音。纸上是听不到声音的——' +
      '语音只在手机上跟着这份说明书走，老人翻到那一步点绿色按钮就能听。';
    bindExportList(); renderExportList();
    openSheet('#sheet-export');
  }

  /* ================= 长按进入创作 ================= */
  var LP = 3000, lpTimer = null, lpDone = false;
  function lpStart(e) {
    if (e) e.preventDefault();
    lpDone = false;
    $('#lp-btn').classList.add('pressing');
    lpTimer = setTimeout(function () { lpDone = true; lpStop(); openSheet('#sheet-confirm'); }, LP);
  }
  function lpStop() {
    clearTimeout(lpTimer); lpTimer = null;
    var b = $('#lp-btn');
    b.classList.add('noanim');
    b.classList.remove('pressing');
    void b.offsetWidth;
    b.classList.remove('noanim');
  }

  /* ================= 绑定 ================= */
  function bind() {
    var lp = $('#lp-btn');
    lp.addEventListener('pointerdown', lpStart);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      lp.addEventListener(ev, function () { if (!lpDone) lpStop(); });
    });
    lp.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    $('#cf-yes').addEventListener('click', function () {
      S.mode = 'edit'; closeSheet(); renderHome(); toast('已进入创作模式，改完记得点右上角退出');
    });
    $('#cf-no').addEventListener('click', function () { closeSheet(); });
    $('#btn-exit').addEventListener('click', function () { S.mode = 'read'; dropDraft(); renderHome(); });
    $('#mask').addEventListener('click', closeSheet);

    $('#us-save').addEventListener('click', function () {
      closeSheet(); saveDraft(); dropDraft(); renderHome(); show('view-home');
    });
    $('#us-no').addEventListener('click', function () {
      closeSheet(); dropDraft(); renderHome(); show('view-home');
      toast('这次的改动没有保存');
    });
    $('#us-cancel').addEventListener('click', closeSheet);

    $('#btn-new').addEventListener('click', function () {
      var v = prompt('这份说明书是教什么的？写成老人听得懂的话', '新说明书');
      if (v === null) return;
      var g = {
        id: uid(), title: (v || '').trim() || '新说明书',
        color: COVER_COLORS[S.guides.length % 6], font: 3, theme: 'white',
        lastIndex: 0, updatedAt: Date.now(), steps: []
      };
      S.guides.unshift(g); save(); openSteps(g.id);
    });

    $('#steps-back').addEventListener('click', leaveSteps);
    $('#steps-rename').addEventListener('click', function () {
      var g = wg();
      var v = prompt('给这份说明书起个名字', g.title);
      if (v === null) return;
      g.title = (v || '').trim() || g.title; g.updatedAt = Date.now(); markDirty(); renderSteps();
    });
    $('#steps-style').addEventListener('click', openStyle);
    $('#steps-export').addEventListener('click', openExport);
    $('#st-close').addEventListener('click', closeSheet);
    $('#ex-close').addEventListener('click', closeSheet);

    $('#file-camera').addEventListener('change', function () { addStepFromFile(this.files[0]); this.value = ''; });
    $('#file-gallery').addEventListener('change', function () { addStepFromFile(this.files[0]); this.value = ''; });
    $('#file-ann').addEventListener('change', function () {
      var self = this, f = this.files[0];
      if (!f) return;
      toast('正在处理照片…');
      fileToData(f, function (url) {
        var st = getStep(U.gid, U.sid);
        st.img = url; st.strokes = []; markDirty();
        loadImg(url, function () { renderAnn(); });
        self.value = '';
        openCrop(st.id);
      });
    });

    $$('#seg-perpage .seg-bt').forEach(function (b) {
      b.addEventListener('click', function () {
        U.perPage = parseInt(b.getAttribute('data-p'), 10);
        $$('#seg-perpage .seg-bt').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
      });
    });
    /* 导出时弹窗保持打开，让教导者看到进度；存完才关掉 */
    $('#ex-pdf').addEventListener('click', function () {
      var g = wg();
      U.exDone = function () { closeSheet(); renderExportList(); };
      exProg('正在准备照片…');
      loadAll(g.steps, function () { exportPDF(g); });
    });
    $('#ex-img').addEventListener('click', function () {
      var g = wg();
      U.exDone = function () { closeSheet(); renderExportList(); };
      exProg('正在准备照片…');
      loadAll(g.steps, function () { exportLongImage(g); });
    });

    /* 标注工具 */
    $$('#tool-row .btn-tool').forEach(function (b) {
      b.addEventListener('click', function () {
        U.tool = b.getAttribute('data-tool');
        $$('#tool-row .btn-tool').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
      });
    });
    $$('#color-row .dot-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        U.color = b.getAttribute('data-color');
        $$('#color-row .dot-btn').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
      });
    });
    $('#ann-undo').addEventListener('click', function () {
      var st = getStep(U.gid, U.sid);
      st.strokes.pop(); markDirty(); renderAnn();
    });
    $('#ann-clear').addEventListener('click', function () {
      var st = getStep(U.gid, U.sid);
      st.strokes = []; markDirty(); renderAnn();
    });
    $('#ann-text').addEventListener('input', function () {
      getStep(U.gid, U.sid).text = this.value; markDirty(); updateHint();
    });
    $('#ann-back').addEventListener('click', function () {
      recAbort();
      getStep(U.gid, U.sid).text = $('#ann-text').value; markDirty();
      show('view-steps'); renderSteps();
    });
    $('#ann-save').addEventListener('click', function () {
      recAbort();
      getStep(U.gid, U.sid).text = $('#ann-text').value; markDirty();
      show('view-steps'); renderSteps();
      toast('这一步改好了，回到列表记得点「保存修改」');
    });
    $('#ann-pick').addEventListener('click', function () { $('#file-ann').click(); });
    $('#ann-crop').addEventListener('click', function () { openCrop(U.sid); });
    $('#ann-delstep').addEventListener('click', function () {
      var g = wg(), st = getStep(U.gid, U.sid);
      var i = g.steps.indexOf(st);
      if (i < 0) return;
      if (!confirm('删掉第 ' + (i + 1) + ' 步吗？照片和录音一起删，找不回来了。')) return;
      recAbort();
      if (st.audio) U.audioTrash.push(st.audio);
      g.steps.splice(i, 1); g.updatedAt = Date.now();
      markDirty(); show('view-steps'); renderSteps(); toast('这一步删掉了，记得点「保存修改」');
    });

    var c = $('#ann-canvas');
    c.addEventListener('pointerdown', function (e) {
      var st = getStep(U.gid, U.sid);
      var p = annPos(c, e);
      try { c.setPointerCapture(e.pointerId); } catch (err) { }
      if (U.tool === 'number') {
        /* 序号是「点一下就落一个」，所以按下即入列，之后拖动只是挪位置。
           以前是等抬手才入列，手指稍微一抖就被判成拖动，结果一个都加不上。 */
        var n = 1;
        st.strokes.forEach(function (o) { if (o.t === 'number' && o.n >= n) n = o.n + 1; });
        draw = { t: 'number', x: p.x, y: p.y, c: U.color, n: n };
        st.strokes.push(draw); markDirty(); renderAnn();
        return;
      }
      draw = { t: U.tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, cx: p.x, cy: p.y, rx: 0, ry: 0, c: U.color, p: [{ x: p.x, y: p.y }] };
      st.strokes.push(draw);
      renderAnn();
    });
    c.addEventListener('pointermove', function (e) {
      if (!draw) return;
      var p = annPos(c, e);
      if (draw.t === 'number') { draw.x = p.x; draw.y = p.y; renderAnn(); return; }
      if (draw.t === 'free') { draw.p.push({ x: p.x, y: p.y }); }
      else {
        draw.x2 = p.x; draw.y2 = p.y;
        draw.cx = (draw.x1 + p.x) / 2; draw.cy = (draw.y1 + p.y) / 2;
        draw.rx = Math.abs(p.x - draw.x1) / 2; draw.ry = Math.abs(p.y - draw.y1) / 2;
      }
      renderAnn();
    });
    c.addEventListener('pointerup', function (e) {
      if (!draw) return;
      var st = getStep(U.gid, U.sid);
      if (draw.t === 'number') {
        /* 已经在按下时入列了，这里不再重复添加 */
      } else if (draw.t === 'free') {
        if (draw.p.length < 2) st.strokes.pop();
      } else {
        var dx = Math.abs(draw.x2 - draw.x1), dy = Math.abs(draw.y2 - draw.y1);
        if (dx < 0.012 && dy < 0.02) st.strokes.pop();
      }
      draw = null; markDirty(); renderAnn();
    });
    c.addEventListener('pointercancel', function () { draw = null; renderAnn(); });

    cropBind();
    zoomBind();

    /* 阅读 */
    $('#read-back').addEventListener('click', function () { stopPlay(); show('view-home'); renderHome(); });
    $('#read-prev').addEventListener('click', function () {
      if (U.idx > 0) { U.idx--; getG(U.gid).lastIndex = U.idx; save(); renderRead(); }
    });
    $('#read-next').addEventListener('click', function () {
      var g = getG(U.gid);
      if (U.idx < g.steps.length - 1) { U.idx++; g.lastIndex = U.idx; save(); renderRead(); }
    });
    $('#read-speak').addEventListener('click', function () {
      var g = getG(U.gid);
      stopPlay();
      speak(g.steps[U.idx] ? g.steps[U.idx].text : '');
    });
    $('#read-audio').addEventListener('click', function () {
      var g = getG(U.gid), st = g.steps[U.idx];
      if (!st || !st.audio) { toast('这一步还没录语音'); return; }
      if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch (e) { } }
      playClip(st.audio, $('#read-audio'), $('#read-audio-txt'), '听家里人说的<em>录好的话，最清楚</em>');
    });
  }

  /* 原生那边存完文件后，会回调这个把列表刷新出来 */
  try { window.renderExportList = renderExportList; } catch (e) { }

  /* ---- 比例单位：--sp = 屏幕宽的 1%，所有留白按它换算 ---- */
  function applyScale() {
    var el = document.querySelector('.app');
    if (!el) return;
    var w = el.clientWidth || 480;
    if (w > 0) el.style.setProperty('--sp', (w / 100) + 'px');
  }

  /* ================= 启动 ================= */
  load();
  bind();
  applyScale();
  window.addEventListener('resize', applyScale);
  window.addEventListener('orientationchange', function () { setTimeout(applyScale, 200); });
  renderHome();
  if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); } catch (e) { } }
})();
