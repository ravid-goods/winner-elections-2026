// Shared helpers for the player page and the admin page.
(function () {
  const C = window.WINNER;
  const TOTAL = C.TOTAL;

  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const fmt = (v, dec) => (dec ? v.toFixed(1) : String(Math.round(v)));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function blocSums(vals) {
    const s = { R: 0, L: 0, A: 0 };
    C.PARTIES.forEach((p, i) => { s[p.bloc] += vals[i]; });
    return C.BLOC_ORDER.map((k) => s[k]);
  }
  function blocText(vals, dec) {
    const b = blocSums(vals);
    return C.BLOC_ORDER.map((k, i) => C.BLOCS[k].label + ' ' + fmt(b[i], dec)).join(' · ');
  }

  // ---------- bloc donut ----------
  function pt(c, r, a) {
    const t = a * Math.PI / 180;
    return (c + r * Math.cos(t)).toFixed(2) + ' ' + (c + r * Math.sin(t)).toFixed(2);
  }
  function arc(c, r0, r1, a0, a1) {
    const lg = (a1 - a0) > 180 ? 1 : 0;
    return 'M' + pt(c, r1, a0) + ' A' + r1 + ' ' + r1 + ' 0 ' + lg + ' 1 ' + pt(c, r1, a1) +
      ' L' + pt(c, r0, a1) + ' A' + r0 + ' ' + r0 + ' 0 ' + lg + ' 0 ' + pt(c, r0, a0) + ' Z';
  }
  // Clockwise from 12 o'clock; the grey remainder is seats not yet allocated.
  // o = { c, r0, r1, gap (deg), tick (draw the 61 line), dec }
  function donut(svg, blocVals, o) {
    const segs = C.BLOC_ORDER.map((k, i) => ({ v: blocVals[i], color: C.BLOCS[k].color, label: C.BLOCS[k].label }));
    const used = sum(blocVals);
    if (used < TOTAL) segs.push({ v: TOTAL - used, color: 'var(--empty)', label: 'טרם חולקו' });
    let a = -90, out = '';
    segs.forEach((s) => {
      if (s.v <= 0) return;
      const sweep = s.v / TOTAL * 360;
      let a0 = a + o.gap / 2, a1 = a + sweep - o.gap / 2;
      if (sweep >= 359.9) { a0 = a; a1 = a + 359.98; }
      if (a1 > a0) {
        out += '<path d="' + arc(o.c, o.r0, o.r1, a0, a1) + '" style="fill:' + s.color + '"><title>' +
          esc(s.label) + ': ' + fmt(s.v, o.dec) + ' מנדטים</title></path>';
      }
      a += sweep;
    });
    if (o.tick) {
      const t = -90 + 61 / TOTAL * 360;
      out += '<path d="M' + pt(o.c, o.r0 - 3, t) + ' L' + pt(o.c, o.r1 + 4, t) + '" stroke="#fff" stroke-width="1.5"/>';
      const lp = pt(o.c, o.r1 + 11, t).split(' ');
      out += '<text x="' + lp[0] + '" y="' + (+lp[1] + 3) + '" fill="#fff" font-size="9" font-weight="700" text-anchor="middle">61</text>';
    }
    svg.innerHTML = out;
  }
  function legendHTML(blocVals, dec, opts) {
    opts = opts || {};
    let html = '';
    C.BLOC_ORDER.forEach((k, i) => {
      html += '<div class="lg-row"><span class="sw" style="background:' + C.BLOCS[k].color + '"></span><span>' +
        C.BLOCS[k].label + '</span><b class="k num">' + fmt(blocVals[i], dec) + '</b></div>';
    });
    if (opts.empty) {
      html += '<div class="lg-row"><span class="sw" style="background:var(--empty)"></span><span>טרם חולקו</span><b class="k num">' +
        fmt(TOTAL - sum(blocVals), dec) + '</b></div>';
    }
    if (opts.note) html += '<div class="lg-note">הקו הלבן = 61, רוב בכנסת</div>';
    return html;
  }
  // Party rows. order: party indexes to show; editable adds +/- buttons.
  function rowsHTML(vals, order, opts) {
    opts = opts || {};
    return order.map((i) => {
      const p = C.PARTIES[i], v = vals[i], col = C.BLOCS[p.bloc].color, w = Math.min(100, v / 30 * 100);
      return '<div class="p-row' + (opts.editable ? '' : ' ro') + '"><span class="stripe" style="background:' + col + '"></span>' +
        '<div><div class="p-name">' + p.name + '</div><div class="track"><div class="fill" style="width:' + w + '%;background:' + col + '"></div></div></div>' +
        '<span class="p-n k num' + (v ? '' : ' zero') + '">' + fmt(v, opts.dec) + '</span>' +
        (opts.editable ? '<div class="step"><button type="button" data-i="' + i + '" data-d="-1" aria-label="פחות ל' + p.name + '">−</button>' +
          '<button type="button" data-i="' + i + '" data-d="1" aria-label="יותר ל' + p.name + '">+</button></div>' : '') +
        '</div>';
    }).join('');
  }
  const byValueDesc = (vals) => vals.map((_, i) => i).sort((a, b) => vals[b] - vals[a]);

  // ---------- time ----------
  // Epoch ms of an Israel wall-clock hour (DST-safe via Intl).
  function israelTime(y, mo, d, h) {
    const guess = Date.UTC(y, mo - 1, d, h, 0, 0), g = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(new Date(guess)).forEach((p) => { g[p.type] = p.value; });
    const offset = Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute, +g.second) - guess;
    return guess - offset;
  }
  const CLOSE_MS = israelTime(C.CLOSE.y, C.CLOSE.m, C.CLOSE.d, C.CLOSE.h);
  // Same moment as a sortable wall-clock number (YYYYMMDDHHMMSS), for sheet timestamps.
  const CLOSE_WALL = C.CLOSE.y * 1e10 + C.CLOSE.m * 1e8 + C.CLOSE.d * 1e6 + C.CLOSE.h * 1e4;
  const isClosed = () => Date.now() >= CLOSE_MS;

  // Drives every [data-countdown] block; calls onClose once when the polls close.
  function startCountdown(onClose) {
    const pad = (n) => (n < 10 ? '0' : '') + n;
    let fired = isClosed();
    function tick() {
      const left = Math.max(0, CLOSE_MS - Date.now()), s = Math.floor(left / 1000);
      document.querySelectorAll('[data-countdown]').forEach((c) => {
        c.querySelector('[data-h]').textContent = pad(Math.floor(s / 3600));
        c.querySelector('[data-m]').textContent = pad(Math.floor(s / 60) % 60);
        c.querySelector('[data-s]').textContent = pad(s % 60);
        c.classList.toggle('closed', !left);
        if (!left) c.querySelector('[data-label]').textContent = 'הקלפיות נסגרו';
      });
      if (!left && !fired) { fired = true; if (onClose) onClose(); }
    }
    tick();
    setInterval(tick, 1000);
  }

  // ---------- bets ----------
  function validBet(v) {
    return Array.isArray(v) && v.length === C.PARTIES.length &&
      v.every((n) => Number.isInteger(n) && (n === 0 || (n >= C.MIN_SEATS && n <= TOTAL))) && sum(v) === TOTAL;
  }
  const encodeBet = (v) => v.join('-');
  function decodeBet(s) {
    const v = String(s || '').trim().split('-').map(Number);
    return validBet(v) ? v : null;
  }

  // ---------- sheet CSV ----------
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((f) => f.trim() !== ''));
  }
  // Google Sheets timestamp (sheet time zone = Israel) -> { wall, hhmm } or null.
  // Handles 27/10/2026 14:05:33, 10/27/2026 2:05:33 PM, 27.10.2026 and 2026-10-27.
  function parseSheetTime(s) {
    const m = String(s).match(/(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})\D+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
    if (!m) return null;
    let y, mo, d, h = +m[4];
    const a = +m[1], b = +m[2], c = +m[3];
    if (m[1].length === 4) { y = a; mo = b; d = c; }
    else if (a > 12) { d = a; mo = b; y = c; }
    else if (b > 12) { mo = a; d = b; y = c; }
    else { d = a; mo = b; y = c; }
    if (m[7]) { const pm = /p/i.test(m[7]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    const mi = +m[5], sec = +(m[6] || 0);
    return { wall: y * 1e10 + mo * 1e8 + d * 1e6 + h * 1e4 + mi * 100 + sec, hhmm: (h < 10 ? '0' : '') + h + ':' + m[5] };
  }

  // ---------- sharing ----------
  function shareWhatsApp(text) {
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }
  // Native share sheet when available, otherwise copy to clipboard.
  async function shareOther(text) {
    if (navigator.share) {
      try { await navigator.share({ text }); return 'shared'; } catch (e) { return 'cancelled'; }
    }
    try { await navigator.clipboard.writeText(text); return 'copied'; } catch (e) { return 'failed'; }
  }

  // ---------- storage (best effort) ----------
  function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode */ } }

  window.W = {
    sum, fmt, esc, blocSums, blocText, donut, legendHTML, rowsHTML, byValueDesc,
    CLOSE_MS, CLOSE_WALL, isClosed, startCountdown,
    validBet, encodeBet, decodeBet, parseCSV, parseSheetTime,
    shareWhatsApp, shareOther, load, save
  };
})();
