// Share images: PNG cards drawn on a canvas, sent to WhatsApp with the share text.
(function () {
  const C = window.WINNER, W = window.W;
  const WD = 1080, PAD = 64, R = WD - PAD;
  const HEX = { R: '#3987e5', L: '#c98500', A: '#d55181' };   // canvas can't read the CSS bloc variables
  const INK = '#ffffff', INK2 = '#9fb0e6', ACCENT = '#3fd6ff', EMPTY = 'rgba(255,255,255,0.13)';
  const SITE = (location.origin + location.pathname.replace(/[^/]*$/, '')).replace(/^https?:\/\//, '');
  const HEADER_H = 360, PIE_H = 470, FOOTER_H = 110;

  let fonts = null;
  function loadFonts() {
    if (!fonts) {
      fonts = Promise.all(['700 60px Karantina', '400 30px Heebo', '700 30px Heebo', '800 30px Heebo']
        .map((f) => document.fonts.load(f, 'אב12'))).catch(() => null);
    }
    return fonts;
  }

  // ---------- drawing primitives ----------
  function canvas(h) {
    const c = document.createElement('canvas');
    c.width = WD;
    c.height = Math.ceil(h);
    const x = c.getContext('2d');
    x.direction = 'rtl';
    const g = x.createRadialGradient(WD / 2, 0, 0, WD / 2, 0, 1000);
    g.addColorStop(0, '#22357e');
    g.addColorStop(1, '#0b1433');
    x.fillStyle = g;
    x.fillRect(0, 0, WD, c.height);
    return [c, x];
  }
  function text(x, str, px, py, o) {
    x.font = (o.weight || 400) + ' ' + o.size + 'px ' + (o.family || 'Heebo') + ', sans-serif';
    x.fillStyle = o.color || INK;
    x.textAlign = o.align || 'right';
    x.textBaseline = 'alphabetic';
    if (o.ltr) x.direction = 'ltr';
    x.fillText(str, px, py);
    const w = x.measureText(str).width;
    x.direction = 'rtl';
    return w;
  }
  function roundPath(x, px, py, w, h, r) {
    x.beginPath();
    if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h);
  }
  function box(x, px, py, w, h, r, fill) {
    roundPath(x, px, py, w, h, r);
    x.fillStyle = fill;
    x.fill();
  }
  function panel(x, py, h, o) {
    o = o || {};
    x.save();
    roundPath(x, PAD, py, WD - 2 * PAD, h, 24);
    x.fillStyle = o.fill || 'rgba(255,255,255,0.05)';
    x.fill();
    x.lineWidth = 2;
    x.strokeStyle = o.stroke || 'rgba(255,255,255,0.12)';
    if (o.dash) x.setLineDash([12, 8]);
    x.stroke();
    x.restore();
  }
  // Bloc donut, clockwise from 12 o'clock, grey = not yet allocated.
  function donut(x, cx, cy, r0, r1, blocVals, o) {
    const segs = C.BLOC_ORDER.map((k, i) => [blocVals[i], HEX[k]]);
    const used = W.sum(blocVals);
    if (used < C.TOTAL - 0.001) segs.push([C.TOTAL - used, EMPTY]);
    const gap = (o.gap || 0) * Math.PI / 180;
    let a = -Math.PI / 2;
    segs.forEach(([v, col]) => {
      if (v <= 0) return;
      const sw = v / C.TOTAL * Math.PI * 2;
      let a0 = a + gap / 2, a1 = a + sw - gap / 2;
      if (sw > Math.PI * 2 - 0.01) { a0 = a; a1 = a + sw; }
      if (a1 > a0) {
        x.beginPath();
        x.arc(cx, cy, r1, a0, a1);
        x.arc(cx, cy, r0, a1, a0, true);
        x.closePath();
        x.fillStyle = col;
        x.fill();
      }
      a += sw;
    });
    if (o.tick) {
      const t = -Math.PI / 2 + 61 / C.TOTAL * Math.PI * 2;
      x.strokeStyle = '#fff';
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(cx + (r0 - 8) * Math.cos(t), cy + (r0 - 8) * Math.sin(t));
      x.lineTo(cx + (r1 + 10) * Math.cos(t), cy + (r1 + 10) * Math.sin(t));
      x.stroke();
      text(x, '61', cx + (r1 + 30) * Math.cos(t), cy + (r1 + 30) * Math.sin(t) + 10, { size: 26, weight: 700, align: 'center' });
    }
  }

  // ---------- blocks ----------
  function header(x, title1, title2, sub) {
    const pill = '● שידור חי';
    x.font = '800 30px Heebo, sans-serif';
    const pw = x.measureText(pill).width + 40;
    box(x, R - pw, PAD, pw, 54, 8, '#ff2d48');
    text(x, pill, R - 20, PAD + 38, { size: 30, weight: 800 });
    text(x, 'Winner בחירות 2026', PAD, PAD + 38, { size: 32, weight: 700, align: 'left' });
    // two-tone title, shrunk to fit long names
    let size = 130;
    x.font = '700 ' + size + 'px Karantina, sans-serif';
    const full = x.measureText(title1).width + (title2 ? 24 + x.measureText(title2).width : 0);
    if (full > WD - 2 * PAD) size = Math.floor(size * (WD - 2 * PAD) / full);
    const w1 = text(x, title1, R, PAD + 210, { size, weight: 700, family: 'Karantina' });
    if (title2) text(x, title2, R - w1 - 24 * size / 130, PAD + 210, { size, weight: 700, family: 'Karantina', color: ACCENT });
    if (sub) text(x, sub, R, PAD + 270, { size: 32, color: INK2 });
    return HEADER_H;
  }
  function pieBlock(x, y, vals, o) {
    const b = W.blocSums(vals), cx = R - 210, cy = y + 215;
    panel(x, y, PIE_H - 30);
    donut(x, cx, cy, 120, 175, b, { gap: 1.5, tick: true });
    text(x, o.center, cx, cy + 32, { size: 110, weight: 700, family: 'Karantina', align: 'center' });
    text(x, o.centerSub, cx, cy + 76, { size: 26, color: INK2, align: 'center' });
    let ly = y + 125;
    const lx = cx - 235;
    C.BLOC_ORDER.forEach((k, i) => {
      box(x, lx - 28, ly - 28, 28, 28, 7, HEX[k]);
      text(x, C.BLOCS[k].label, lx - 46, ly - 2, { size: 34, weight: 700 });
      text(x, W.fmt(b[i], o.dec), PAD + 36, ly + 8, { size: 76, weight: 700, family: 'Karantina', align: 'left' });
      ly += 100;
    });
    return y + PIE_H;
  }
  function partyRows(x, y, vals, order, dec) {
    order.forEach((i) => {
      const p = C.PARTIES[i], v = vals[i], col = HEX[p.bloc];
      box(x, R - 8, y + 8, 8, 58, 4, col);
      text(x, p.name, R - 28, y + 38, { size: 36 });
      const tx0 = PAD + 150, tw = R - 28 - tx0, fw = Math.min(1, v / 30) * tw;
      box(x, tx0, y + 52, tw, 12, 6, 'rgba(255,255,255,0.08)');
      if (fw > 1) box(x, R - 28 - fw, y + 52, fw, 12, 6, col);
      text(x, W.fmt(v, dec), PAD, y + 62, { size: 66, weight: 700, family: 'Karantina', align: 'left', color: v ? INK : 'rgba(255,255,255,0.3)' });
      x.fillStyle = 'rgba(255,255,255,0.07)';
      x.fillRect(PAD, y + 78, WD - 2 * PAD, 2);
      y += 80;
    });
    return y;
  }
  function legendStrip(x, y) {
    let lx = R;
    C.BLOC_ORDER.forEach((k) => {
      box(x, lx - 26, y + 12, 26, 26, 6, HEX[k]);
      const w = text(x, C.BLOCS[k].label, lx - 40, y + 36, { size: 30, color: INK2 });
      lx -= 40 + w + 44;
    });
    return y + 70;
  }
  function footer(x, y) {
    text(x, SITE, WD / 2, y + 60, { size: 30, color: INK2, align: 'center', ltr: true });
  }
  async function toFile(c, name) {
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    return blob ? new File([blob], name, { type: 'image/png' }) : null;
  }

  // ---------- cards ----------
  // A single bet or the group average. o: { title1, title2, sub, vals, dec, order, center, centerSub, file }
  async function bet(o) {
    await loadFonts();
    const [c, x] = canvas(HEADER_H + PIE_H + o.order.length * 80 + FOOTER_H);
    let y = header(x, o.title1, o.title2, o.sub);
    y = pieBlock(x, y, o.vals, { dec: o.dec, center: o.center || '120', centerSub: o.centerSub || 'מנדטים' });
    y = partyRows(x, y, o.vals, o.order, o.dec);
    footer(x, y);
    return toFile(c, o.file);
  }
  // Everyone's bets: a bloc bar and a mini donut per participant.
  async function all(entries) {
    await loadFonts();
    const [c, x] = canvas(HEADER_H + 70 + entries.length * 150 + FOOTER_H);
    let y = header(x, 'ההימורים', 'של כולם', entries.length + ' משתתפים');
    y = legendStrip(x, y);
    entries.forEach((e) => {
      const b = W.blocSums(e.bet);
      panel(x, y, 134);
      text(x, e.name, R - 30, y + 52, { size: 40, weight: 700 });
      donut(x, PAD + 76, y + 67, 30, 52, b, { gap: 4 });
      const bx0 = PAD + 160, bw = R - 30 - bx0;
      let bx = R - 30;
      C.BLOC_ORDER.forEach((k, i) => {
        const w = b[i] / C.TOTAL * bw;
        if (w <= 0) return;
        box(x, bx - w + 2, y + 74, Math.max(2, w - 4), 42, 6, HEX[k]);
        if (w > 46) text(x, String(b[i]), bx - w / 2, y + 107, { size: 32, weight: 800, align: 'center', color: '#071030' });
        bx -= w;
      });
      y += 150;
    });
    footer(x, y);
    return toFile(c, 'winner-2026-all-bets.png');
  }
  // Real results + ranking. rows come from the admin ranking (avg row included).
  async function rank(rows, real) {
    await loadFonts();
    const [c, x] = canvas(HEADER_H + PIE_H + rows.length * 130 + FOOTER_H);
    let y = header(x, 'מי', 'צדק?', 'הדירוג לפי סטייה: סכום ההפרשים מהתוצאות האמיתיות');
    y = pieBlock(x, y, real, { center: '120', centerSub: 'תוצאות אמת' });
    rows.forEach((r) => {
      const first = !r.avg && r.rank === 1;
      panel(x, y, 112, first ? { fill: 'rgba(255,210,63,0.16)', stroke: 'rgba(255,210,63,0.65)' }
        : r.avg ? { fill: 'rgba(0,0,0,0)', stroke: 'rgba(63,214,255,0.6)', dash: true } : {});
      text(x, r.avg ? '≈' : String(r.rank), R - 50, y + 80, { size: 80, weight: 700, family: 'Karantina', align: 'center' });
      text(x, r.name, R - 110, y + 56, { size: 40, weight: 700 });
      const tag = r.avg ? 'חוכמת ההמונים' : first ? '🏆 מקום ראשון' : '';
      if (tag) text(x, tag, R - 110, y + 94, { size: 26, color: INK2 });
      donut(x, PAD + 230, y + 56, 24, 44, W.blocSums(r.bet), { gap: 4 });
      text(x, W.fmt(r.d, r.avg), PAD + 30, y + 68, { size: 72, weight: 700, family: 'Karantina', align: 'left' });
      text(x, 'סטייה', PAD + 30, y + 98, { size: 22, color: INK2, align: 'left' });
      y += 130;
    });
    footer(x, y);
    return toFile(c, 'winner-2026-ranking.png');
  }

  window.Cards = { bet, all, rank, loadFonts };
})();
