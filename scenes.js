/* ============================================================================
   scenes.js: one illustrated, scroll-driven animation per beat.

   Every scene is drawn in code as SVG on a 400 x 300 board, and exposes
   update(q, t): q is the beat's scroll progress (0 to 1), t is seconds, used
   only for small idle life (a pulse, a waveform). Scroll drives the story of
   each scene; nothing important happens on a timer.

   Figures shown inside scenes are the real ones from the case studies
   (163 of 234 seats, 10,000 to 3,000 and 30%, 99.95%, 98%). Everything else
   is illustration and carries no numbers.
   ========================================================================== */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var C = {
    ink: '#ecebe6', soft: '#a3a39b', dim: '#5b5e63', line: '#2a2d33', card: '#15171b', card2: '#1c1f24',
    acc: '#43e29b', red: '#ff5a4f', yt: '#ff3b3b', gold: '#f4c542', blue: '#6aa9ff'
  };

  function el(tag, a, p) {
    var e = document.createElementNS(NS, tag);
    for (var k in a) e.setAttribute(k, a[k]);
    if (p) p.appendChild(e);
    return e;
  }
  function txt(s, a, p) { var e = el('text', a, p); e.textContent = s; return e; }
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var ease = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  var outc = function (x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); };
  var win = function (q, a, b) { return ease((q - a) / (b - a)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  function tf(e, x, y, s, r) {
    e.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')' +
      (s != null && s !== 1 ? ' scale(' + s.toFixed(4) + ')' : '') + (r ? ' rotate(' + r.toFixed(2) + ')' : ''));
  }
  function op(e, v) { e.setAttribute('opacity', clamp(v, 0, 1).toFixed(3)); }
  function pill(p, x, y, w, h, fill, stroke) { return el('rect', { x: x, y: y, width: w, height: h, rx: h / 2, fill: fill, stroke: stroke || 'none' }, p); }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  var S = {};

  // ---- ABOUT: the route so far. Chennai, Nicosia, Chennai, Singapore. -------
  S.route = {
    build: function (g) {
      var P = { che: [190, 146], nic: [72, 50], sin: [326, 262] };
      this.legs = ['M190 146 Q86 136 72 50', 'M72 50 Q166 50 190 146', 'M190 146 Q196 262 326 262'].map(function (d) {
        el('path', { d: d, fill: 'none', stroke: C.line, 'stroke-width': 2, 'stroke-dasharray': '3 6' }, g);
        var p = el('path', { d: d, fill: 'none', stroke: C.acc, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, g);
        var L = p.getTotalLength(); p.setAttribute('stroke-dasharray', L); p.setAttribute('stroke-dashoffset', L);
        return { p: p, L: L };
      });
      function pin(xy, name, sub, anchor, dx, dy) {
        var grp = el('g', {}, g);
        el('circle', { cx: xy[0], cy: xy[1], r: 13, fill: C.acc, opacity: 0.14 }, grp);
        el('circle', { cx: xy[0], cy: xy[1], r: 6, fill: C.ink }, grp);
        var lab = el('g', {}, g);
        txt(name, { x: xy[0] + dx, y: xy[1] + dy, 'text-anchor': anchor, fill: C.ink, 'font-size': 15, 'font-weight': 600 }, lab);
        var s = txt(sub, { x: xy[0] + dx, y: xy[1] + dy + 17, 'text-anchor': anchor, fill: C.soft, 'font-size': 11.5 }, lab);
        return { g: grp, lab: lab, sub: s };
      }
      this.che = pin(P.che, 'Chennai', 'B.E., SSN · 2020 to 2024', 'start', 18, 6);
      this.che2 = txt('Everstage · 2024 to 2026', { x: P.che[0] + 18, y: P.che[1] + 40, fill: C.acc, 'font-size': 11.5 }, g);
      this.nic = pin(P.nic, 'Nicosia, Cyprus', 'Research intern · 2023', 'start', 18, 4);
      this.sin = pin(P.sin, 'Singapore', 'MSc, NUS · 2026', 'middle', 0, -36);
      this.dot = el('circle', { r: 7, fill: C.acc }, g);
    },
    update: function (q) {
      var d = win(q, 0.06, 0.86), parts = [0.36, 0.3, 0.34], acc = 0, head = null;
      this.legs.forEach(function (lg, i) {
        var f = clamp((d - acc) / parts[i], 0, 1);
        lg.p.setAttribute('stroke-dashoffset', (lg.L * (1 - f)).toFixed(2));
        if (f > 0) head = lg.p.getPointAtLength(lg.L * f);
        acc += parts[i];
      });
      if (!head) head = { x: 190, y: 146 };
      if (head) { this.dot.setAttribute('cx', head.x.toFixed(1)); this.dot.setAttribute('cy', head.y.toFixed(1)); }
      op(this.dot, win(q, 0.02, 0.08));
      op(this.che.g, win(q, 0.0, 0.06)); op(this.che.lab, win(q, 0.02, 0.1));
      op(this.nic.g, win(d, 0.3, 0.36)); op(this.nic.lab, win(d, 0.32, 0.4));
      op(this.che2, win(d, 0.62, 0.68));
      op(this.sin.g, win(d, 0.96, 1)); op(this.sin.lab, win(q, 0.84, 0.92));
    }
  };

  // ---- NOURISHAI: a burger builds, fries pop, the query rejects both, and a
  //      protein bowl rises. ----------------------------------------------------
  S.nourish = {
    build: function (g) {
      var b = this.burger = el('g', {}, g);
      var layers = [
        ['path', { d: 'M-62 0 Q-62 -18 -50 -20 L50 -20 Q62 -18 62 0 Z', fill: '#d99a4e' }],
        ['rect', { x: -64, y: -37, width: 128, height: 17, rx: 8, fill: '#6a3a22' }],
        ['path', { d: 'M-62 -39 L62 -39 L58 -31 L41 -26 L31 -31 L12 -24 L-5 -31 L-27 -25 L-44 -31 L-62 -31 Z', fill: '#f2c14e' }],
        ['path', { d: 'M-67 -44 Q-56 -53 -45 -44 Q-34 -53 -23 -44 Q-12 -53 0 -44 Q12 -53 23 -44 Q34 -53 45 -44 Q56 -53 67 -44 L62 -38 L-62 -38 Z', fill: '#6fbf5a' }],
        ['rect', { x: -56, y: -55, width: 112, height: 10, rx: 5, fill: '#e0533d' }],
        ['path', { d: 'M-63 -57 Q-63 -112 0 -112 Q63 -112 63 -57 Z', fill: '#e2a458' }]
      ];
      this.layers = layers.map(function (L) { var w = el('g', {}, b); el(L[0], L[1], w); return w; });
      var top = this.layers[5];
      [[-30, -88], [-8, -98], [16, -90], [34, -78], [-44, -74], [2, -76]].forEach(function (s) {
        el('ellipse', { cx: s[0], cy: s[1], rx: 3.4, ry: 1.8, fill: '#f6e3b8', transform: 'rotate(-20 ' + s[0] + ' ' + s[1] + ')' }, top);
      });
      this.btag = this.tag(g, '✕  over 500 kcal', C.red);

      var f = this.fries = el('g', {}, g);
      var fc = el('clipPath', { id: 'friesclip' }, g);
      el('rect', { x: -70, y: -200, width: 140, height: 206 }, fc);
      var fin = el('g', { 'clip-path': 'url(#friesclip)' }, f);
      var R = rng(11); this.fr = [];
      for (var i = 0; i < 8; i++) {
        var x = -34 + i * 9.5, h = 52 + R() * 22;
        var s = el('rect', { x: x, y: -h, width: 9, height: h, rx: 2, fill: '#f4c542', transform: 'rotate(' + ((R() - 0.5) * 12).toFixed(1) + ' ' + (x + 4) + ' 0)' }, fin);
        this.fr.push(s);
      }
      el('path', { d: 'M-40 -52 L-47 -52 L-40 12 L40 12 L47 -52 L40 -52 Z', fill: '#d8412f' }, f);
      el('rect', { x: -44, y: -30, width: 88, height: 7, fill: '#b8321f' }, f);
      this.ftag = this.tag(g, '✕  fried', C.red);

      var sp = this.search = el('g', {}, g);
      pill(sp, 30, 14, 340, 38, C.card2, '#34383f');
      el('circle', { cx: 52, cy: 32, r: 7, fill: 'none', stroke: C.soft, 'stroke-width': 2 }, sp);
      el('line', { x1: 57, y1: 37, x2: 62, y2: 42, stroke: C.soft, 'stroke-width': 2, 'stroke-linecap': 'round' }, sp);
      this.q = txt('', { x: 72, y: 37.5, fill: C.ink, 'font-size': 13.5 }, sp);
      this.qfull = 'high-protein, under 500 kcal, not fried';

      var bw = this.bowl = el('g', {}, g);
      el('ellipse', { cx: 0, cy: -22, rx: 84, ry: 16, fill: '#2c4a2a' }, bw);
      [[-50, -30, '#6fbf5a'], [-24, -36, '#8fd36e'], [4, -34, '#6fbf5a'], [30, -32, '#8fd36e'], [54, -28, '#6fbf5a']].forEach(function (l) {
        el('ellipse', { cx: l[0], cy: l[1], rx: 20, ry: 10, fill: l[2] }, bw);
      });
      [[-30, -38], [-4, -42], [22, -38]].forEach(function (c) { el('rect', { x: c[0], y: c[1], width: 26, height: 10, rx: 5, fill: '#c98a4b', transform: 'rotate(-12 ' + c[0] + ' ' + c[1] + ')' }, bw); });
      [[46, -40], [-54, -38]].forEach(function (e) { el('circle', { cx: e[0], cy: e[1], r: 9, fill: '#f6f1e4' }, bw); el('circle', { cx: e[0], cy: e[1], r: 4.2, fill: '#f2b632' }, bw); });
      el('path', { d: 'M-86 -22 Q-86 46 0 46 Q86 46 86 -22 Z', fill: '#e9e4d8' }, bw);
      el('path', { d: 'M-86 -22 Q-86 46 0 46 Q86 46 86 -22', fill: 'none', stroke: '#c9c2b2', 'stroke-width': 2 }, bw);
      this.checks = ['✓  high-protein', '✓  under 500 kcal', '✓  not fried'].map(function (s, i) {
        var t = el('g', {}, g); pill(t, 0, 0, 128, 26, 'rgba(67,226,155,0.12)', C.acc);
        txt(s, { x: 64, y: 17.5, 'text-anchor': 'middle', fill: C.acc, 'font-size': 12, 'font-weight': 600 }, t);
        return t;
      });
    },
    tag: function (g, s, col) {
      var t = el('g', {}, g); pill(t, -62, -13, 124, 26, 'rgba(255,90,79,0.12)', col);
      txt(s, { x: 0, y: 4.5, 'text-anchor': 'middle', fill: col, 'font-size': 12, 'font-weight': 600 }, t);
      return t;
    },
    update: function (q) {
      var self = this;
      var out = win(q, 0.7, 0.86);
      // the burger assembles, layer by layer
      this.layers.forEach(function (l, i) {
        var k = outc((q - (0.03 + i * 0.05)) / 0.09);
        tf(l, 0, -(1 - k) * 110); op(l, k);
      });
      tf(this.burger, 128 - out * 150, 250); op(this.burger, 1 - out);
      // fries slide in and pop up
      var fk = win(q, 0.14, 0.3);
      tf(this.fries, 292 + (1 - fk) * 90 + out * 150, 238); op(this.fries, fk * (1 - out));
      this.fr.forEach(function (s, i) {
        var k = outc((q - 0.22 - i * 0.012) / 0.1), h = Number(s.getAttribute('height'));
        s.setAttribute('y', (-h * (0.3 + 0.7 * k)).toFixed(1));
      });
      // the query types itself
      op(this.search, win(q, 0.32, 0.38));
      var n = Math.round(win(q, 0.36, 0.55) * this.qfull.length);
      if (n !== this.n) { this.n = n; this.q.textContent = this.qfull.slice(0, n); }
      // both get rejected, then leave
      tf(this.btag, 128 - out * 150, 108); op(this.btag, win(q, 0.57, 0.62) * (1 - out));
      tf(this.ftag, 292 + out * 150, 150); op(this.ftag, win(q, 0.6, 0.65) * (1 - out));
      // the bowl rises, and it passes all three
      var bk = win(q, 0.74, 0.9);
      tf(this.bowl, 200, 250 + (1 - bk) * 70); op(this.bowl, bk);
      this.checks.forEach(function (c, i) { var k = win(q, 0.84 + i * 0.035, 0.9 + i * 0.035); tf(c, 136, 78 + i * 34 + (1 - k) * 8); op(c, k); });
      void self;
    }
  };

  // ---- CONTENT ARENA: a video plays; the channel ranking re-sorts from
  //      subscribers to normalised engagement. ---------------------------------
  S.arena = {
    build: function (g) {
      var pl = el('g', {}, g);
      el('rect', { x: 40, y: 10, width: 320, height: 150, rx: 16, fill: C.card, stroke: C.line }, pl);
      el('rect', { x: 52, y: 22, width: 296, height: 112, rx: 10, fill: '#1d1418' }, pl);
      this.play = el('g', {}, pl);
      el('rect', { x: -34, y: -24, width: 68, height: 48, rx: 14, fill: C.yt }, this.play);
      el('path', { d: 'M-9 -13 L15 0 L-9 13 Z', fill: '#fff' }, this.play);
      el('rect', { x: 56, y: 144, width: 288, height: 4, rx: 2, fill: C.line }, pl);
      this.bar = el('rect', { x: 56, y: 144, width: 0, height: 4, rx: 2, fill: C.yt }, pl);
      this.head = el('circle', { cx: 56, cy: 146, r: 6, fill: C.yt }, pl);
      this.h1 = txt('Ranked by subscribers', { x: 40, y: 184, fill: C.soft, 'font-size': 12 }, g);
      this.h2 = txt('Ranked by engagement, normalised', { x: 40, y: 184, fill: C.acc, 'font-size': 12, 'font-weight': 600 }, g);
      var rows = [
        { n: '@giant', subs: 1.0, eng: 0.22, col: '#8f6bff' },
        { n: '@steady', subs: 0.66, eng: 0.42, col: '#6aa9ff' },
        { n: '@you', subs: 0.34, eng: 0.6, col: '#f4c542' },
        { n: '@rising', subs: 0.18, eng: 0.96, col: C.acc }
      ];
      var byEng = rows.slice().sort(function (a, b) { return b.eng - a.eng; });
      rows.forEach(function (r, i) {
        r.i0 = i; r.i1 = byEng.indexOf(r);
        r.g = el('g', {}, g);
        r.bg = el('rect', { x: 34, y: -11, width: 282, height: 22, rx: 8, fill: '#0a0b0d' }, r.g);
        el('circle', { cx: 50, cy: 0, r: 9, fill: r.col }, r.g);
        txt(r.n, { x: 66, y: 4, fill: C.ink, 'font-size': 12.5 }, r.g);
        el('rect', { x: 140, y: -6, width: 168, height: 12, rx: 6, fill: C.line }, r.g);
        r.bar = el('rect', { x: 140, y: -6, width: 0, height: 12, rx: 6, fill: C.soft }, r.g);
      });
      this.rows = rows;
      this.badge = el('g', {}, g);
      pill(this.badge, 0, -11, 78, 22, 'rgba(67,226,155,0.14)', C.acc);
      txt('real rival', { x: 39, y: 4, 'text-anchor': 'middle', fill: C.acc, 'font-size': 11, 'font-weight': 600 }, this.badge);
    },
    update: function (q, t) {
      var play = win(q, 0.02, 0.95), m = win(q, 0.68, 0.76);
      this.bar.setAttribute('width', (288 * play).toFixed(1));
      this.head.setAttribute('cx', (56 + 288 * play).toFixed(1));
      tf(this.play, 200, 78, 1 + 0.04 * Math.sin(t * 3));
      op(this.h1, 1 - win(q, 0.64, 0.7)); op(this.h2, win(q, 0.68, 0.74));
      // The re-sort happens after the scene has settled, one climber at a
      // time, while the rows it passes step down to make room.
      var ORD = [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 1, 0], [3, 2, 1, 0]];
      var steps = [win(q, 0.7, 0.78), win(q, 0.78, 0.86), win(q, 0.86, 0.94)];
      var k = steps[2] > 0 ? 2 : steps[1] > 0 ? 1 : 0, f = steps[k];
      var parent = this.rows[0].g.parentNode;
      this.rows.forEach(function (r, i) {
        var from = ORD[k][i], to = ORD[k + 1][i], climbing = to < from && f > 0 && f < 1;
        var y = 206 + lerp(from, to, f) * 24;
        var dx = climbing ? Math.sin(Math.PI * f) * 14 : 0;
        // the climber is a raised card that slides over the rows it passes
        r.bg.setAttribute('fill', climbing ? C.card2 : '#0a0b0d');
        r.bg.setAttribute('stroke', climbing ? C.acc : 'none');
        if (climbing && parent.lastChild !== r.g) parent.insertBefore(r.g, null);
        var w = lerp(r.subs, r.eng, m) * 168 * win(q, 0.08 + i * 0.04, 0.22 + i * 0.04);
        r.g.setAttribute('transform', 'translate(' + dx.toFixed(2) + ' ' + y.toFixed(2) + ')' + (climbing ? ' translate(175 0) scale(' + (1 + 0.05 * Math.sin(Math.PI * f)).toFixed(4) + ') translate(-175 0)' : ''));
        r.bar.setAttribute('width', Math.max(0, w).toFixed(1));
        r.bar.setAttribute('fill', r.n === '@rising' && m > 0.5 ? C.acc : C.soft);
      });
      if (this.badge.parentNode.lastChild !== this.badge) this.badge.parentNode.appendChild(this.badge);
      tf(this.badge, 316, 206); op(this.badge, win(q, 0.93, 0.98));
    }
  };

  // ---- ELECTION: a spreadsheet streams, gets cleaned, and folds into one
  //      number: 163 of 234. ----------------------------------------------------
  S.sheet = {
    build: function (g) {
      var sh = this.sh = el('g', {}, g);
      el('rect', { x: 30, y: 10, width: 340, height: 214, rx: 12, fill: C.card, stroke: C.line }, sh);
      el('rect', { x: 30, y: 10, width: 340, height: 30, rx: 12, fill: C.card2 }, sh);
      ['Seat', '2021', '2026', 'Margin'].forEach(function (h, i) { txt(h, { x: 46 + i * 84, y: 30, fill: C.soft, 'font-size': 11.5, 'font-weight': 600 }, sh); });
      var clip = el('clipPath', { id: 'sheetclip' }, g);
      el('rect', { x: 30, y: 40, width: 340, height: 184 }, clip);
      var body = el('g', { 'clip-path': 'url(#sheetclip)' }, sh);
      this.body = el('g', {}, body);
      var R = rng(5); this.bad = [];
      for (var r = 0; r < 20; r++) {
        el('line', { x1: 30, y1: 40 + r * 20, x2: 370, y2: 40 + r * 20, stroke: C.line }, this.body);
        for (var c = 0; c < 4; c++) {
          var w = 22 + R() * 40, isBad = (c === 1 || c === 2) && R() < 0.28;
          var cell = el('rect', { x: 44 + c * 84, y: 47 + r * 20, width: w, height: 7, rx: 3.5, fill: isBad ? C.red : C.dim }, this.body);
          if (isBad) this.bad.push({ el: cell, r: r });
        }
      }
      this.cap = txt('8,000+ rows · 234 seats · 2 cycles', { x: 200, y: 250, 'text-anchor': 'middle', fill: C.soft, 'font-size': 12.5 }, g);
      this.clean = txt('names reconciled', { x: 200, y: 250, 'text-anchor': 'middle', fill: C.acc, 'font-size': 12.5, 'font-weight': 600 }, g);
      var d = this.donut = el('g', {}, g);
      el('circle', { cx: 0, cy: 0, r: 74, fill: 'none', stroke: C.line, 'stroke-width': 22 }, d);
      this.circ = 2 * Math.PI * 74;
      this.arc = el('circle', { cx: 0, cy: 0, r: 74, fill: 'none', stroke: C.acc, 'stroke-width': 22, 'stroke-dasharray': this.circ, 'stroke-dashoffset': this.circ, transform: 'rotate(-90)' }, d);
      this.num = txt('0', { x: 0, y: 8, 'text-anchor': 'middle', fill: C.ink, 'font-size': 40, 'font-weight': 700 }, d);
      txt('of 234 seats flipped', { x: 0, y: 30, 'text-anchor': 'middle', fill: C.soft, 'font-size': 12 }, d);
    },
    update: function (q) {
      tf(this.body, 0, -win(q, 0, 0.62) * 180);
      var sweep = win(q, 0.38, 0.6);
      this.bad.forEach(function (b) {
        var on = sweep * 20 > (b.r - 9 * win(q, 0, 0.62));
        b.el.setAttribute('fill', on ? C.acc : C.red); b.el.setAttribute('opacity', on ? 0.7 : 0.9);
      });
      op(this.cap, 1 - win(q, 0.36, 0.44)); op(this.clean, win(q, 0.44, 0.5) * (1 - win(q, 0.62, 0.68)));
      var fold = win(q, 0.62, 0.78);
      this.sh.setAttribute('transform', 'translate(' + (200 * fold * 0.62).toFixed(1) + ' ' + (117 * fold * 0.62).toFixed(1) + ') scale(' + (1 - fold * 0.62).toFixed(3) + ')');
      op(this.sh, 1 - win(q, 0.7, 0.8));
      var dk = win(q, 0.72, 0.84), f = win(q, 0.76, 0.96);
      tf(this.donut, 200, 140, 0.8 + 0.2 * dk); op(this.donut, dk);
      this.arc.setAttribute('stroke-dashoffset', (this.circ * (1 - 0.697 * f)).toFixed(1));
      var n = Math.round(163 * f); if (n !== this.nv) { this.nv = n; this.num.textContent = String(n); }
    }
  };

  // ---- FORAGE: DAU climbs, retention falls, and the funnel tells the truth.
  S.retention = {
    build: function (g) {
      el('line', { x1: 40, y1: 180, x2: 360, y2: 180, stroke: C.line }, g);
      el('line', { x1: 40, y1: 20, x2: 40, y2: 180, stroke: C.line }, g);
      function line(d, col, w) {
        var p = el('path', { d: d, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
        var L = p.getTotalLength(); p.setAttribute('stroke-dasharray', L); p.setAttribute('stroke-dashoffset', L); return { p: p, L: L };
      }
      this.dau = line('M40 168 C 90 160, 120 140, 160 132 S 230 96, 270 84 S 330 52, 356 40', C.soft, 2.5);
      this.ret = line('M40 34 C 70 90, 100 120, 150 138 S 260 156, 356 162', C.acc, 3);
      this.l1 = txt('DAU, rising', { x: 300, y: 36, fill: C.soft, 'font-size': 12, 'text-anchor': 'end' }, g);
      this.l2 = txt('7-day retention, falling', { x: 356, y: 152, fill: C.acc, 'font-size': 12, 'font-weight': 600, 'text-anchor': 'end' }, g);
      var f = this.fun = el('g', {}, g);
      txt('10,000 installed', { x: 40, y: 214, fill: C.soft, 'font-size': 12 }, f);
      el('rect', { x: 40, y: 220, width: 260, height: 16, rx: 8, fill: C.line }, f);
      this.b1 = el('rect', { x: 40, y: 220, width: 0, height: 16, rx: 8, fill: C.soft }, f);
      txt('3,000 back on day 7', { x: 40, y: 258, fill: C.soft, 'font-size': 12 }, f);
      el('rect', { x: 40, y: 264, width: 260, height: 16, rx: 8, fill: C.line }, f);
      this.b2 = el('rect', { x: 40, y: 264, width: 0, height: 16, rx: 8, fill: C.acc }, f);
      this.pct = txt('0%', { x: 360, y: 272, 'text-anchor': 'end', fill: C.acc, 'font-size': 34, 'font-weight': 700 }, f);
    },
    update: function (q) {
      var a = win(q, 0.04, 0.34), b = win(q, 0.3, 0.58);
      this.dau.p.setAttribute('stroke-dashoffset', (this.dau.L * (1 - a)).toFixed(1));
      this.ret.p.setAttribute('stroke-dashoffset', (this.ret.L * (1 - b)).toFixed(1));
      op(this.l1, win(q, 0.26, 0.34)); op(this.l2, win(q, 0.5, 0.58));
      op(this.fun, win(q, 0.58, 0.64));
      this.b1.setAttribute('width', (260 * win(q, 0.62, 0.74)).toFixed(1));
      var k = win(q, 0.72, 0.9);
      this.b2.setAttribute('width', (78 * k).toFixed(1));
      var n = Math.round(30 * k); if (n !== this.nv) { this.nv = n; this.pct.textContent = n + '%'; }
    }
  };

  // ---- VOICE AGENT: the phone rings, the voice lands, the answer comes from
  //      the knowledge base. ----------------------------------------------------
  S.voice = {
    build: function (g) {
      var ph = this.phone = el('g', {}, g);
      el('rect', { x: -38, y: -70, width: 76, height: 140, rx: 14, fill: C.card, stroke: '#3a3e45', 'stroke-width': 2 }, ph);
      el('rect', { x: -30, y: -58, width: 60, height: 112, rx: 6, fill: '#12161a' }, ph);
      txt('Tier 1', { x: 0, y: -30, 'text-anchor': 'middle', fill: C.soft, 'font-size': 10 }, ph);
      txt('call', { x: 0, y: -17, 'text-anchor': 'middle', fill: C.soft, 'font-size': 10 }, ph);
      el('circle', { cx: 0, cy: 28, r: 12, fill: C.acc }, ph);
      el('path', { d: 'M-5 24 q5 10 10 0', fill: 'none', stroke: '#04140c', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, ph);
      this.rings = [0, 1, 2].map(function () { return el('circle', { cx: 0, cy: 0, r: 50, fill: 'none', stroke: C.acc, 'stroke-width': 1.5 }, g); });
      this.bars = [];
      for (var i = 0; i < 22; i++) this.bars.push(el('rect', { x: 150 + i * 9.6, y: 60, width: 5, height: 4, rx: 2.5, fill: C.acc }, g));
      function bubble(p, x, y, w, s, mine) {
        var b = el('g', {}, p);
        el('rect', { x: x, y: y, width: w, height: 34, rx: 12, fill: mine ? 'rgba(67,226,155,0.14)' : C.card2, stroke: mine ? C.acc : C.line }, b);
        var t = txt('', { x: x + 12, y: y + 21.5, fill: mine ? C.ink : C.soft, 'font-size': 12 }, b);
        return { g: b, t: t, s: s };
      }
      this.b1 = bubble(g, 150, 118, 210, 'How do I reset my password?', false);
      this.b2 = bubble(g, 170, 164, 196, 'Here is how, step by step.', true);
      this.kb = txt('answered from the knowledge base', { x: 366, y: 226, 'text-anchor': 'end', fill: C.acc, 'font-size': 11.5, 'font-weight': 600 }, g);
    },
    update: function (q, t) {
      var ring = 1 - win(q, 0.2, 0.3);
      tf(this.phone, 76, 150, 1, Math.sin(t * 22) * 4 * ring * win(q, 0.02, 0.06));
      this.rings.forEach(function (r, i) {
        var ph = ((t * 0.8 + i / 3) % 1);
        r.setAttribute('cx', 76); r.setAttribute('cy', 150); r.setAttribute('r', (60 + ph * 40).toFixed(1));
        op(r, (1 - ph) * 0.5 * ring);
      });
      var live = win(q, 0.08, 0.2) * (1 - win(q, 0.62, 0.72) * 0.8);
      this.bars.forEach(function (b, i) {
        var h = 6 + (Math.sin(t * 7 + i * 0.7) * 0.5 + 0.5) * (Math.sin(i * 0.45 + q * 9) * 0.5 + 0.5) * 50 * live;
        b.setAttribute('height', h.toFixed(1)); b.setAttribute('y', (72 - h / 2).toFixed(1));
      });
      var self = this;
      [[this.b1, 0.34, 0.46], [this.b2, 0.56, 0.72]].forEach(function (x) {
        var B = x[0], k = win(q, x[1] - 0.04, x[1]);
        op(B.g, k);
        var n = Math.round(win(q, x[1], x[2]) * B.s.length);
        if (n !== B.n) { B.n = n; B.t.textContent = B.s.slice(0, n); }
      });
      op(this.kb, win(q, 0.76, 0.84));
      void self;
    }
  };

  // ---- FATHOM x FRESHDESK: a call ends, the summary travels through N8N,
  //      and lands in the right ticket. -----------------------------------------
  S.pipe = {
    build: function (g) {
      function card(x, y, w, h, title) {
        var c = el('g', {}, g);
        el('rect', { x: x, y: y, width: w, height: h, rx: 14, fill: C.card, stroke: C.line }, c);
        txt(title, { x: x + w / 2, y: y - 10, 'text-anchor': 'middle', fill: C.soft, 'font-size': 12, 'font-weight': 600 }, g);
        return c;
      }
      var call = card(14, 100, 104, 96, 'Fathom');
      txt('call ended', { x: 66, y: 126, 'text-anchor': 'middle', fill: C.ink, 'font-size': 11.5 }, call);
      for (var i = 0; i < 9; i++) el('rect', { x: 30 + i * 8.5, y: 150 - (i % 3) * 5, width: 4, height: 12 + (i % 3) * 10, rx: 2, fill: C.soft }, call);
      card(158, 112, 84, 72, 'N8N');
      this.gear = el('g', {}, g);
      var d = '';
      for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4; d += 'M' + (Math.cos(a) * 16).toFixed(1) + ' ' + (Math.sin(a) * 16).toFixed(1) + ' L' + (Math.cos(a) * 24).toFixed(1) + ' ' + (Math.sin(a) * 24).toFixed(1) + ' '; }
      el('path', { d: d, stroke: C.acc, 'stroke-width': 7, 'stroke-linecap': 'round' }, this.gear);
      el('circle', { cx: 0, cy: 0, r: 17, fill: C.acc }, this.gear);
      el('circle', { cx: 0, cy: 0, r: 7, fill: C.card }, this.gear);
      card(280, 86, 110, 124, 'Freshdesk');
      txt('Ticket', { x: 296, y: 112, fill: C.ink, 'font-size': 12, 'font-weight': 600 }, g);
      el('rect', { x: 296, y: 122, width: 76, height: 6, rx: 3, fill: C.dim }, g);
      el('rect', { x: 296, y: 134, width: 56, height: 6, rx: 3, fill: C.dim }, g);
      this.ck = ['Summary', 'Recording'].map(function (s, i) {
        var r = el('g', {}, g);
        el('circle', { cx: 304, cy: 160 + i * 24, r: 8, fill: C.acc }, r);
        el('path', { d: 'M300 ' + (160 + i * 24) + ' l3 3 l5 -6', fill: 'none', stroke: '#04140c', 'stroke-width': 2 }, r);
        txt(s, { x: 318, y: 164 + i * 24, fill: C.ink, 'font-size': 12 }, r);
        return r;
      });
      this.p1 = el('path', { d: 'M118 148 L158 148', stroke: C.line, 'stroke-width': 2, 'stroke-dasharray': '4 5' }, g);
      this.p2 = el('path', { d: 'M242 148 L280 148', stroke: C.line, 'stroke-width': 2, 'stroke-dasharray': '4 5' }, g);
      txt('webhook', { x: 138, y: 238, 'text-anchor': 'middle', fill: C.soft, 'font-size': 11 }, g);
      txt('routing', { x: 261, y: 238, 'text-anchor': 'middle', fill: C.soft, 'font-size': 11 }, g);
      this.doc = el('g', {}, g);
      el('rect', { x: -13, y: -16, width: 26, height: 32, rx: 4, fill: C.ink }, this.doc);
      [-6, 0, 6].forEach(function (y) { el('rect', { x: -8, y: y - 1.5, width: 16, height: 3, rx: 1.5, fill: C.dim }, this.doc); }, this);
      this.zero = txt('zero-touch', { x: 200, y: 272, 'text-anchor': 'middle', fill: C.acc, 'font-size': 14, 'font-weight': 700 }, g);
    },
    update: function (q) {
      var a = win(q, 0.1, 0.4), b = win(q, 0.46, 0.74), x;
      if (q < 0.43) x = lerp(66, 200, a); else x = lerp(200, 335, b);
      var y = 148 - Math.sin(Math.PI * (q < 0.43 ? a : b)) * 34;
      tf(this.doc, x, y); op(this.doc, win(q, 0.06, 0.12) * (1 - win(q, 0.74, 0.8)));
      tf(this.gear, 200, 148, 1, q * 540);
      this.p1.setAttribute('stroke', a > 0 && a < 1 ? C.acc : C.line);
      this.p2.setAttribute('stroke', b > 0 && b < 1 ? C.acc : C.line);
      this.ck.forEach(function (c, i) { op(c, win(q, 0.76 + i * 0.05, 0.82 + i * 0.05)); });
      op(this.zero, win(q, 0.88, 0.94));
    }
  };

  // ---- IoV / ASCON: packets flow from car to tower, attacks bounce off the
  //      shield, and the detector reads 99.95%. -------------------------------
  S.iov = {
    build: function (g) {
      el('line', { x1: 10, y1: 250, x2: 390, y2: 250, stroke: C.line, 'stroke-width': 2 }, g);
      var car = this.car = el('g', {}, g);
      el('path', { d: 'M-52 0 L-52 -18 Q-50 -26 -40 -28 L-22 -28 L-8 -46 L26 -46 L42 -28 L52 -24 Q56 -20 56 -10 L56 0 Z', fill: '#e9e4d8' }, car);
      el('path', { d: 'M-4 -42 L22 -42 L34 -29 L-15 -29 Z', fill: '#2a3440' }, car);
      el('circle', { cx: -30, cy: 0, r: 11, fill: '#1c1f24', stroke: '#8f8f88', 'stroke-width': 3 }, car);
      el('circle', { cx: 34, cy: 0, r: 11, fill: '#1c1f24', stroke: '#8f8f88', 'stroke-width': 3 }, car);
      var tw = el('g', {}, g);
      el('path', { d: 'M320 250 L334 120 L348 250 M324 210 L344 210 M327 175 L341 175', stroke: '#8f8f88', 'stroke-width': 3, fill: 'none' }, tw);
      this.waves = [0, 1, 2].map(function (i) { return el('path', { d: 'M' + (322 - i * 9) + ' ' + (110 - i * 7) + ' q12 ' + (-10 - i * 5) + ' 24 0', fill: 'none', stroke: C.acc, 'stroke-width': 2, 'stroke-linecap': 'round' }, tw); });
      this.shield = el('path', { d: 'M-72 6 Q-72 -80 2 -86 Q76 -80 76 6', fill: 'rgba(67,226,155,0.06)', stroke: C.acc, 'stroke-width': 2.5 }, car);
      this.pk = []; for (var i = 0; i < 6; i++) this.pk.push(el('rect', { width: 9, height: 9, rx: 2, fill: C.acc }, g));
      this.at = []; for (var j = 0; j < 4; j++) this.at.push(el('rect', { width: 10, height: 10, rx: 2, fill: C.red }, g));
      this.read = txt('0.00%', { x: 20, y: 48, fill: C.acc, 'font-size': 36, 'font-weight': 700 }, g);
      this.rl = txt('DoS detection accuracy', { x: 22, y: 70, fill: C.soft, 'font-size': 12 }, g);
    },
    update: function (q, t) {
      var cx = lerp(-60, 120, outc(q / 0.22)), cy = 238;
      tf(this.car, cx, cy);
      var sh = win(q, 0.3, 0.42);
      op(this.shield, sh);
      this.waves.forEach(function (w, i) { op(w, 0.3 + 0.7 * ((Math.sin(t * 4 - i) + 1) / 2)); });
      var flow = win(q, 0.12, 0.2);
      this.pk.forEach(function (p, i) {
        var k = (t * 0.3 + i / 6 + q) % 1;
        var x = lerp(cx + 30, 334, k), y = lerp(cy - 40, 118, k) - Math.sin(k * Math.PI) * 30;
        p.setAttribute('x', (x - 4.5).toFixed(1)); p.setAttribute('y', (y - 4.5).toFixed(1)); op(p, flow * Math.min(1, k * 6, (1 - k) * 6));
      });
      var atk = win(q, 0.18, 0.26);
      this.at.forEach(function (a, i) {
        var k = (t * 0.42 + i / 4 + q * 0.5) % 1, stop = sh > 0.5 ? 0.72 : 1.0;
        var kk = Math.min(k, stop);
        var x = lerp(230, cx + 4, kk), y = lerp(20, cy - 60, kk);
        a.setAttribute('x', (x - 5).toFixed(1)); a.setAttribute('y', (y - 5).toFixed(1));
        var fade = k > stop ? Math.max(0, 1 - (k - stop) * 6) : 1;
        op(a, atk * fade);
      });
      var v = 99.95 * win(q, 0.56, 0.86);
      var s = v.toFixed(2) + '%'; if (s !== this.rv) { this.rv = s; this.read.textContent = s; }
      op(this.read, win(q, 0.52, 0.58)); op(this.rl, win(q, 0.54, 0.6));
    }
  };

  // ---- CROP YIELD: the soil is read, and the plant grows into the answer. ---
  S.crop = {
    build: function (g) {
      el('rect', { x: 20, y: 214, width: 360, height: 80, rx: 10, fill: '#3a2a1f' }, g);
      el('path', { d: 'M20 240 Q110 232 200 242 T380 238', stroke: '#4a3727', 'stroke-width': 3, fill: 'none' }, g);
      this.gauges = [['pH', 0.62], ['moisture', 0.78], ['soil type', 0.5]].map(function (x, i) {
        var gg = el('g', {}, g);
        txt(x[0], { x: 40 + i * 118, y: 262, fill: '#d6c7b2', 'font-size': 11.5 }, gg);
        el('rect', { x: 40 + i * 118, y: 270, width: 92, height: 8, rx: 4, fill: '#2a1e16' }, gg);
        var b = el('rect', { x: 40 + i * 118, y: 270, width: 0, height: 8, rx: 4, fill: C.gold }, gg);
        return { b: b, v: x[1] };
      });
      this.stem = el('path', { d: 'M200 214 L200 214', stroke: '#6fbf5a', 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none' }, g);
      this.leaves = [[190, -1], [168, 1], [146, -1], [124, 1]].map(function (l) {
        return { g: el('path', { d: 'M0 0 Q ' + (26 * l[1]) + ' -18 ' + (48 * l[1]) + ' -6 Q ' + (24 * l[1]) + ' 4 0 0 Z', fill: '#6fbf5a' }, g), y: l[0], s: l[1] };
      });
      this.head = el('g', {}, g);
      for (var k = 0; k < 7; k++) el('ellipse', { cx: (k % 2 ? 7 : -7), cy: -k * 9, rx: 6, ry: 9, fill: C.gold, transform: 'rotate(' + (k % 2 ? 24 : -24) + ' ' + (k % 2 ? 7 : -7) + ' ' + (-k * 9) + ')' }, this.head);
      this.acc = txt('98%', { x: 380, y: 60, 'text-anchor': 'end', fill: C.acc, 'font-size': 38, 'font-weight': 700 }, g);
      this.al = txt('validation accuracy', { x: 380, y: 80, 'text-anchor': 'end', fill: C.soft, 'font-size': 12 }, g);
      this.rf = txt('Random Forest recommends', { x: 20, y: 30, fill: C.soft, 'font-size': 12 }, g);
    },
    update: function (q) {
      this.gauges.forEach(function (x, i) { x.b.setAttribute('width', (92 * x.v * win(q, 0.05 + i * 0.06, 0.2 + i * 0.06)).toFixed(1)); });
      var h = 214 - 120 * win(q, 0.3, 0.8);
      this.stem.setAttribute('d', 'M200 214 Q' + (196).toFixed(0) + ' ' + ((214 + h) / 2).toFixed(1) + ' 200 ' + h.toFixed(1));
      this.leaves.forEach(function (l) {
        var k = outc((214 - h - (214 - l.y)) / 18);
        l.g.setAttribute('transform', 'translate(200 ' + l.y + ') scale(' + Math.max(0.001, k).toFixed(3) + ')');
      });
      var hk = win(q, 0.78, 0.9);
      this.head.setAttribute('transform', 'translate(200 ' + (h - 4).toFixed(1) + ') scale(' + Math.max(0.001, hk).toFixed(3) + ')');
      op(this.acc, win(q, 0.84, 0.92)); op(this.al, win(q, 0.86, 0.94)); op(this.rf, win(q, 0.8, 0.88));
    }
  };

  // ---- GRANARY: the thermometer climbs, the alert fires, the system acts. --
  S.granary = {
    build: function (g) {
      el('path', { d: 'M110 250 L110 96 Q110 50 165 44 Q220 50 220 96 L220 250 Z', fill: C.card, stroke: '#4a4e55', 'stroke-width': 2.5 }, g);
      el('path', { d: 'M114 250 L114 150 Q165 138 216 150 L216 250 Z', fill: '#c9a24b', opacity: 0.8 }, g);
      [120, 170, 220].forEach(function (y) { el('line', { x1: 110, y1: y, x2: 220, y2: y, stroke: '#3a3e45' }, g); });
      this.alert = el('circle', { cx: 165, cy: 150, r: 110, fill: 'none', stroke: C.red, 'stroke-width': 3 }, g);
      this.fan = el('g', {}, g);
      for (var i = 0; i < 4; i++) el('ellipse', { cx: 0, cy: -9, rx: 5, ry: 10, fill: C.soft, transform: 'rotate(' + i * 90 + ')' }, this.fan);
      el('circle', { cx: 0, cy: 0, r: 4, fill: C.ink }, this.fan);
      el('rect', { x: 262, y: 70, width: 18, height: 160, rx: 9, fill: C.card2, stroke: '#4a4e55', 'stroke-width': 2 }, g);
      el('circle', { cx: 271, cy: 238, r: 16, fill: C.card2, stroke: '#4a4e55', 'stroke-width': 2 }, g);
      this.merc = el('rect', { x: 266, y: 200, width: 10, height: 30, rx: 5, fill: C.acc }, g);
      this.bulb = el('circle', { cx: 271, cy: 238, r: 11, fill: C.acc }, g);
      el('line', { x1: 256, y1: 112, x2: 290, y2: 112, stroke: C.red, 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, g);
      txt('threshold', { x: 296, y: 116, fill: C.red, 'font-size': 11 }, g);
      txt('temp', { x: 271, y: 58, 'text-anchor': 'middle', fill: C.soft, 'font-size': 11 }, g);
      el('path', { d: 'M310 200 A 36 36 0 0 1 382 200', fill: 'none', stroke: C.line, 'stroke-width': 8, 'stroke-linecap': 'round' }, g);
      this.needle = el('line', { x1: 0, y1: 0, x2: 0, y2: -30, stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      txt('CO2', { x: 346, y: 222, 'text-anchor': 'middle', fill: C.soft, 'font-size': 11 }, g);
      this.ok = txt('back in range ✓', { x: 165, y: 284, 'text-anchor': 'middle', fill: C.acc, 'font-size': 14, 'font-weight': 700 }, g);
      this.warn = txt('drifting', { x: 165, y: 284, 'text-anchor': 'middle', fill: C.red, 'font-size': 14, 'font-weight': 700 }, g);
    },
    update: function (q, t) {
      var up = win(q, 0.05, 0.45), down = win(q, 0.58, 0.86), lvl = up * (1 - down * 0.8);
      var h = 30 + 140 * lvl, hot = lvl > 0.72;
      this.merc.setAttribute('height', h.toFixed(1)); this.merc.setAttribute('y', (230 - h).toFixed(1));
      var col = hot ? C.red : C.acc;
      this.merc.setAttribute('fill', col); this.bulb.setAttribute('fill', col);
      var ang = -80 + 160 * lvl;
      this.needle.setAttribute('transform', 'translate(346 200) rotate(' + ang.toFixed(1) + ')');
      var al = win(q, 0.4, 0.46) * (1 - win(q, 0.64, 0.72));
      op(this.alert, al * (0.5 + 0.5 * Math.sin(t * 8)));
      tf(this.fan, 165, 70, 1, win(q, 0.52, 1) * 1440);
      op(this.warn, al); op(this.ok, win(q, 0.84, 0.9));
    }
  };

  // ---- POSTURE: slouch, buzz, sit up. ---------------------------------------
  S.posture = {
    build: function (g) {
      el('rect', { x: 250, y: 150, width: 130, height: 8, rx: 4, fill: '#4a4e55' }, g);
      el('rect', { x: 356, y: 158, width: 6, height: 100, fill: '#3a3e45' }, g);
      el('rect', { x: 276, y: 118, width: 64, height: 32, rx: 4, fill: C.card2, stroke: '#4a4e55' }, g);
      el('path', { d: 'M110 258 L110 212 L176 212', stroke: '#4a4e55', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, g);
      this.legs = el('path', { d: 'M150 206 L214 206 L214 256', stroke: C.soft, 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      this.spine = el('path', { stroke: C.ink, 'stroke-width': 10, fill: 'none', 'stroke-linecap': 'round' }, g);
      this.arm = el('path', { stroke: C.soft, 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      this.head = el('circle', { r: 20, fill: C.ink }, g);
      this.dev = el('rect', { width: 14, height: 18, rx: 4, fill: C.acc }, g);
      this.buzz = [0, 1, 2].map(function () { return el('path', { fill: 'none', stroke: C.acc, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g); });
      this.ok = txt('upright ✓', { x: 150, y: 290, 'text-anchor': 'middle', fill: C.acc, 'font-size': 14, 'font-weight': 700 }, g);
    },
    update: function (q, t) {
      var slump = win(q, 0.02, 0.36) * (1 - win(q, 0.56, 0.8));
      var hip = [150, 206];
      var neck = [lerp(150, 196, slump), lerp(110, 132, slump)];
      var mid = [lerp(146, 140, slump) , lerp(158, 146, slump)];
      var c1 = [lerp(144, 118 , slump), lerp(160, 128, slump)];
      this.spine.setAttribute('d', 'M' + hip + ' Q' + c1 + ' ' + neck);
      var head = [neck[0] + lerp(0, 18, slump), neck[1] - lerp(24, 10, slump)];
      this.head.setAttribute('cx', head[0].toFixed(1)); this.head.setAttribute('cy', head[1].toFixed(1));
      this.arm.setAttribute('d', 'M' + (neck[0] - 2).toFixed(1) + ' ' + (neck[1] + 12).toFixed(1) + ' L' + lerp(220, 238, slump).toFixed(1) + ' ' + lerp(160, 150, slump).toFixed(1) + ' L280 146');
      var bx = lerp(mid[0], c1[0], 0.5) - 20, by = lerp(mid[1], c1[1], 0.5) - 6;
      var jig = win(q, 0.38, 0.42) * (1 - win(q, 0.56, 0.6));
      this.dev.setAttribute('x', (bx - 7 + Math.sin(t * 60) * 2 * jig).toFixed(1)); this.dev.setAttribute('y', (by - 9).toFixed(1));
      this.buzz.forEach(function (b, i) {
        var r = 14 + i * 9;
        b.setAttribute('d', 'M' + (bx - r).toFixed(1) + ' ' + (by - r * 0.7).toFixed(1) + ' Q' + (bx - r * 1.35).toFixed(1) + ' ' + by.toFixed(1) + ' ' + (bx - r).toFixed(1) + ' ' + (by + r * 0.7).toFixed(1));
        op(b, jig * (0.4 + 0.6 * ((Math.sin(t * 14 - i) + 1) / 2)));
      });
      op(this.ok, win(q, 0.82, 0.9));
    }
  };

  // ---- D2D: scattered devices find their clusters and pick a mode. ---------
  S.d2d = {
    build: function (g) {
      var R = rng(23), hubs = [[100, 110], [296, 96], [200, 226]], cols = [C.acc, C.blue, C.gold];
      this.nodes = [];
      this.links = el('g', {}, g);
      this.mesh = el('g', {}, g);
      for (var i = 0; i < 15; i++) {
        var c = i % 3, a = R() * Math.PI * 2, d = 22 + R() * 26;
        var n = { x0: 30 + R() * 340, y0: 24 + R() * 250, x1: hubs[c][0] + Math.cos(a) * d, y1: hubs[c][1] + Math.sin(a) * d, c: c, ph: R() * 6 };
        n.link = el('line', { stroke: cols[c], 'stroke-width': 1.6 }, this.links);
        n.el = el('circle', { r: 7, fill: C.soft }, g);
        this.nodes.push(n);
      }
      for (var k = 0; k < 18; k++) el('line', { 'data-a': Math.floor(R() * 15), 'data-b': Math.floor(R() * 15), stroke: C.dim, 'stroke-width': 1 }, this.mesh);
      this.hubs = hubs; this.cols = cols;
      this.pulse = el('circle', { r: 4.5, fill: C.ink }, g);
      this.lab = txt('K-Means · OPTICS · Spectral · Ward', { x: 200, y: 290, 'text-anchor': 'middle', fill: C.soft, 'font-size': 12 }, g);
    },
    update: function (q, t) {
      var m = win(q, 0.26, 0.64), self = this;
      this.nodes.forEach(function (n) {
        var j = (1 - m) * 5;
        n.x = lerp(n.x0, n.x1, m) + Math.sin(t * 1.6 + n.ph) * j; n.y = lerp(n.y0, n.y1, m) + Math.cos(t * 1.3 + n.ph) * j;
        n.el.setAttribute('cx', n.x.toFixed(1)); n.el.setAttribute('cy', n.y.toFixed(1));
        n.el.setAttribute('fill', m > 0.55 ? self.cols[n.c] : C.soft);
        var h = self.hubs[n.c];
        n.link.setAttribute('x1', h[0]); n.link.setAttribute('y1', h[1]);
        n.link.setAttribute('x2', n.x.toFixed(1)); n.link.setAttribute('y2', n.y.toFixed(1));
        op(n.link, win(q, 0.58, 0.7) * 0.8);
      });
      var ls = this.mesh.childNodes;
      for (var i = 0; i < ls.length; i++) {
        var a = this.nodes[+ls[i].getAttribute('data-a')], b = this.nodes[+ls[i].getAttribute('data-b')];
        ls[i].setAttribute('x1', a.x.toFixed(1)); ls[i].setAttribute('y1', a.y.toFixed(1));
        ls[i].setAttribute('x2', b.x.toFixed(1)); ls[i].setAttribute('y2', b.y.toFixed(1));
      }
      op(this.mesh, (1 - m) * 0.9);
      var k = (t * 0.5) % 1, n0 = this.nodes[4], h0 = this.hubs[n0.c];
      this.pulse.setAttribute('cx', lerp(h0[0], n0.x, k).toFixed(1)); this.pulse.setAttribute('cy', lerp(h0[1], n0.y, k).toFixed(1));
      op(this.pulse, win(q, 0.72, 0.8)); op(this.lab, win(q, 0.7, 0.8));
    }
  };

  // ---- PUBLICATIONS: two papers land, and get stamped. ---------------------
  S.papers = {
    build: function (g) {
      function paper(yr, pub) {
        var p = el('g', {}, g);
        el('rect', { x: -70, y: -92, width: 140, height: 184, rx: 6, fill: C.ink }, p);
        el('rect', { x: -56, y: -76, width: 112, height: 10, rx: 3, fill: '#2a2d33' }, p);
        el('rect', { x: -56, y: -60, width: 84, height: 10, rx: 3, fill: '#2a2d33' }, p);
        for (var i = 0; i < 8; i++) el('rect', { x: -56, y: -36 + i * 12, width: i % 3 === 2 ? 70 : 112, height: 5, rx: 2.5, fill: '#b9b6ad' }, p);
        txt(pub, { x: -56, y: 78, fill: '#55585e', 'font-size': 9.5, 'font-weight': 600 }, p);
        txt(yr, { x: 56, y: 78, 'text-anchor': 'end', fill: '#55585e', 'font-size': 9.5, 'font-weight': 600 }, p);
        return p;
      }
      this.a = paper('2025', 'Springer Nature');
      this.b = paper('2026', 'Pleiades · Springer');
      var st = this.stamp = el('g', {}, g);
      el('rect', { x: -92, y: -26, width: 184, height: 52, rx: 8, fill: 'rgba(10,11,13,0.55)', stroke: C.acc, 'stroke-width': 3.5 }, st);
      el('rect', { x: -84, y: -18, width: 168, height: 36, rx: 5, fill: 'none', stroke: C.acc, 'stroke-width': 1.5 }, st);
      txt('PEER REVIEWED', { x: 0, y: 7, 'text-anchor': 'middle', fill: C.acc, 'font-size': 20, 'font-weight': 800, 'letter-spacing': 2 }, st);
      this.x2 = el('g', {}, g);
      el('circle', { cx: 0, cy: 0, r: 22, fill: C.acc }, this.x2);
      txt('×2', { x: 0, y: 7, 'text-anchor': 'middle', fill: '#04140c', 'font-size': 18, 'font-weight': 800 }, this.x2);
    },
    update: function (q) {
      var a = outc((q - 0.04) / 0.22), b = outc((q - 0.14) / 0.22);
      tf(this.a, 150, 150 + (1 - a) * 220, 1, -7 + (1 - a) * -10); op(this.a, a);
      tf(this.b, 246, 146 + (1 - b) * 220, 1, 6 + (1 - b) * 12); op(this.b, b);
      var s = win(q, 0.46, 0.56);
      tf(this.stamp, 200, 168, 1.9 - 0.9 * s, -12); op(this.stamp, s);
      var x = win(q, 0.66, 0.74);
      tf(this.x2, 336, 60, 0.6 + 0.4 * x); op(this.x2, x);
    }
  };

  // ---- PEAK: thirteen months light up, December 2026 to December 2027. ----
  S.months = {
    wide: true,
    build: function (g, phone) {
      var M = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      this.tiles = [];
      var cols = phone ? 7 : 13, w = phone ? 46 : 52, h = phone ? 56 : 76, gap = phone ? 8 : 8;
      this.vb = phone ? [0, 0, 7 * (w + gap) - gap, 2 * (h + 26) + 6] : [0, 0, 13 * (w + gap) - gap, h + 40];
      for (var i = 0; i < 13; i++) {
        var c = i % cols, r = Math.floor(i / cols), x = c * (w + gap), y = r * (h + 30);
        var t = el('g', {}, g);
        var bg = el('rect', { x: x, y: y, width: w, height: h, rx: 10, fill: C.card, stroke: C.line }, t);
        var lab = txt(M[i], { x: x + w / 2, y: y + h / 2 + 5, 'text-anchor': 'middle', fill: C.soft, 'font-size': phone ? 13 : 15, 'font-weight': 600 }, t);
        if (i === 0 || i === 1 || i === 12) txt(i === 0 ? '2026' : '2027', { x: x + w / 2, y: y + h + 18, 'text-anchor': 'middle', fill: C.soft, 'font-size': 11 }, t);
        this.tiles.push({ bg: bg, lab: lab });
      }
    },
    update: function (q) {
      this.tiles.forEach(function (tl, i) {
        var k = win(q, 0.46 + i * 0.022, 0.5 + i * 0.022);
        tl.bg.setAttribute('fill', k > 0.5 ? C.acc : C.card);
        tl.bg.setAttribute('stroke', k > 0.5 ? C.acc : C.line);
        tl.lab.setAttribute('fill', k > 0.5 ? '#04140c' : C.soft);
        tl.bg.setAttribute('transform', 'translate(0 ' + ((1 - k) * 6).toFixed(1) + ')');
      });
    }
  };

  window.SCENES = { registry: S, el: el, NS: NS };
})();
