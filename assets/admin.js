// Admin page: reads the bets from the published Google Sheet CSV,
// shows everyone's bets, the group average, and the ranking against the real results.
(function () {
  const C = window.WINNER, W = window.W;
  const N = C.PARTIES.length, TOTAL = C.TOTAL, KEY = 'winner2026-admin';
  const $ = (id) => document.getElementById(id);
  const ALL = C.PARTIES.map((_, i) => i);

  const saved = W.load(KEY) || {};
  const st = {
    csvUrl: typeof saved.csvUrl === 'string' ? saved.csvUrl : '',
    real: Array.isArray(saved.real) && saved.real.length === N ? saved.real : new Array(N).fill(0)
  };
  const persist = () => W.save(KEY, st);

  let entries = [];    // [{ name, bet, time }] - latest on-time valid bet per name
  let late = [];       // names whose bets arrived after the polls closed
  let invalid = [];    // rows that could not be read
  let tab = 'bets';

  // ---------- loading ----------
  function ingest(text) {
    const rows = W.parseCSV(text);
    const byName = new Map();
    late = []; invalid = [];
    rows.slice(1).forEach((r) => {
      const name = (r[1] || '').trim().replace(/\s+/g, ' ');
      const bet = W.decodeBet(r[2]);
      if (!name || !bet) { invalid.push(name || '(ללא שם)'); return; }
      const t = W.parseSheetTime(r[0]);
      if (t && t.wall >= W.CLOSE_WALL) { late.push(name + ' (' + t.hhmm + ')'); return; }
      byName.set(name, { name, bet, time: t ? t.hhmm : '' });   // later rows replace earlier ones
    });
    entries = [...byName.values()];
    $('meta-text').textContent = entries.length + ' משתתפים · עודכן ' +
      new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    $('load-err').textContent = '';
    render();
  }
  async function refresh() {
    if (!st.csvUrl) return;
    $('meta-text').textContent = 'טוען...';
    try {
      const url = st.csvUrl + (st.csvUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
      const res = await fetch(url, { cache: 'no-store' });
      const text = await res.text();
      if (!res.ok || /^\s*</.test(text)) throw new Error('not csv');
      ingest(text);
    } catch (e) {
      $('meta-text').textContent = '';
      $('load-err').textContent = 'לא הצלחתי לקרוא את הגיליון. ודאו שהוא פורסם כ־CSV, או טענו קובץ ידנית.';
    }
  }

  // ---------- calculations ----------
  function average() {
    if (!entries.length) return new Array(N).fill(0);
    return ALL.map((i) => W.sum(entries.map((e) => e.bet[i])) / entries.length);
  }
  const deviation = (vals) => vals.reduce((s, v, i) => s + Math.abs(v - st.real[i]), 0);
  function ranking() {
    const rows = entries.map((e) => ({ name: e.name, bet: e.bet, d: deviation(e.bet) })).sort((a, b) => a.d - b.d);
    let rank = 0, prev = null;
    rows.forEach((r, i) => { if (r.d !== prev) { rank = i + 1; prev = r.d; } r.rank = rank; });
    if (entries.length) {
      const avg = average(), d = deviation(avg);
      const at = rows.findIndex((r) => r.d > d);
      rows.splice(at < 0 ? rows.length : at, 0, { name: 'ממוצע הקבוצה', bet: avg, d, avg: true });
    }
    return rows;
  }
  const realReady = () => W.sum(st.real) === TOTAL;

  // ---------- rendering ----------
  function mini(svg, vals, dec) {
    W.donut(svg, W.blocSums(vals), { c: 18, r0: 9, r1: 17, gap: 6, dec });
  }
  function renderBets() {
    if (!entries.length) {
      $('bets-list').innerHTML = '<div class="note">עוד אין הימורים בגיליון.</div>';
    } else {
      $('bets-list').innerHTML = entries.map((e, k) =>
        '<div class="card"><div class="card-head"><span class="mini"><svg viewBox="0 0 36 36" data-bet="' + k + '"></svg></span>' +
        '<div><b>' + W.esc(e.name) + '</b><small>' + (e.time ? e.time + ' · ' : '') + W.blocText(e.bet) + '</small></div></div>' +
        '<details><summary>פירוט המפלגות</summary><div class="list">' +
        W.rowsHTML(e.bet, W.byValueDesc(e.bet).filter((i) => e.bet[i] > 0), {}) + '</div></details></div>').join('');
      entries.forEach((e, k) => mini(document.querySelector('[data-bet="' + k + '"]'), e.bet));
    }
    let ex = '';
    if (late.length) ex += '<div class="note"><b>נפסלו (אחרי 22:00):</b><ul class="excluded">' + late.map((n) => '<li>' + W.esc(n) + '</li>').join('') + '</ul></div>';
    if (invalid.length) ex += '<div class="note"><b>שורות שלא הצלחתי לקרוא:</b><ul class="excluded">' + invalid.map((n) => '<li>' + W.esc(n) + '</li>').join('') + '</ul></div>';
    $('excluded').innerHTML = ex;
  }
  function renderAvg() {
    const avg = average(), b = W.blocSums(avg);
    $('avg-n').textContent = entries.length;
    W.donut($('pie-avg'), b, { c: 66, r0: 40, r1: 58, gap: 2, tick: true, dec: true });
    $('lg-avg').innerHTML = W.legendHTML(b, true, { note: true });
    $('list-avg').innerHTML = W.rowsHTML(avg, W.byValueDesc(avg), { dec: true });
  }
  function renderRealSummary() {
    const total = W.sum(st.real), b = W.blocSums(st.real);
    $('real-total').textContent = total;
    W.donut($('pie-real'), b, { c: 66, r0: 40, r1: 58, gap: 2, tick: true });
    $('lg-real').innerHTML = W.legendHTML(b, false, { empty: total < TOTAL, note: true });
    const s = $('real-status');
    if (total === TOTAL) { s.className = 'status ok'; s.textContent = '✓ 120 מנדטים, הדירוג מחושב'; }
    else { s.className = 'status' + (total > TOTAL ? ' err' : ''); s.textContent = 'סה״כ ' + total + ' מתוך 120. הדירוג יחושב כשהסכום יהיה 120.'; }
  }
  function renderRealInputs() {
    $('real-inputs').innerHTML = ALL.map((i) => {
      const p = C.PARTIES[i];
      return '<label class="p-row in"><span class="stripe" style="background:' + C.BLOCS[p.bloc].color + '"></span>' +
        '<span class="p-name">' + p.name + '</span>' +
        '<input type="number" inputmode="numeric" min="0" max="120" data-i="' + i + '" value="' + (st.real[i] || '') + '" placeholder="0"></label>';
    }).join('');
  }
  function renderRank() {
    renderRealSummary();
    $('share-rank').disabled = !realReady() || !entries.length;
    if (!realReady()) { $('rank-list').innerHTML = ''; return; }
    if (!entries.length) { $('rank-list').innerHTML = '<div class="note">עוד אין הימורים לדרג.</div>'; return; }
    const rows = ranking();
    $('rank-list').innerHTML = rows.map((r, k) =>
      '<div class="lb-row' + (r.rank === 1 ? ' first' : '') + (r.avg ? ' avg' : '') + '">' +
      '<span class="lb-rank k">' + (r.avg ? '≈' : r.rank) + '</span>' +
      '<span class="lb-name">' + W.esc(r.name) + (r.avg ? '<small>חוכמת ההמונים</small>' : r.rank === 1 ? '<small>🏆 מקום ראשון</small>' : '') + '</span>' +
      '<span class="mini"><svg viewBox="0 0 36 36" data-rank="' + k + '"></svg></span>' +
      '<span class="lb-dev"><b class="k num">' + W.fmt(r.d, r.avg) + '</b><small>סטייה</small></span></div>').join('');
    rows.forEach((r, k) => mini(document.querySelector('[data-rank="' + k + '"]'), r.bet, r.avg));
  }
  function render() {
    if (tab === 'bets') renderBets();
    if (tab === 'avg') renderAvg();
    if (tab === 'rank') renderRank();
  }

  // ---------- share texts ----------
  function shareText(kind) {
    const head = '🗳️ Winner בחירות 2026';
    if (kind === 'bets') {
      return head + ' · ההימורים של כולם (' + entries.length + ')\n\n' +
        entries.map((e) => '*' + e.name + '*: ' + W.blocText(e.bet)).join('\n');
    }
    if (kind === 'avg') {
      const avg = average();
      return head + ' · ממוצע הקבוצה (' + entries.length + ' משתתפים)\n' + W.blocText(avg, true) + '\n\n' +
        W.byValueDesc(avg).map((i) => C.PARTIES[i].name + ' ' + avg[i].toFixed(1)).join('\n');
    }
    const rows = ranking();
    return '🏆 ' + head + ' · מי צדק?\n(סטייה = סכום ההפרשים מהתוצאות האמיתיות)\n\n' +
      rows.map((r) => (r.avg ? '≈ ' : r.rank + '. ') + r.name + ' · סטייה ' + W.fmt(r.d, r.avg)).join('\n');
  }

  // ---------- events ----------
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === b)));
    ['bets', 'avg', 'rank'].forEach((t) => { $('tab-' + t).hidden = t !== tab; });
    render();
  }));
  document.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', () => {
    if (!entries.length) return;
    W.shareWhatsApp(shareText(b.dataset.share));
  }));
  $('real-inputs').addEventListener('input', (e) => {
    const inp = e.target.closest('input[data-i]');
    if (!inp) return;
    const v = parseInt(inp.value, 10);
    st.real[+inp.dataset.i] = Number.isFinite(v) && v > 0 ? Math.min(v, TOTAL) : 0;
    persist();
    renderRank();
  });
  $('setup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    st.csvUrl = $('csv-url').value.trim();
    persist();
    showMain();
  });
  $('change-url').addEventListener('click', () => {
    $('csv-url').value = st.csvUrl;
    $('main').hidden = true;
    $('setup').hidden = false;
  });
  $('refresh').addEventListener('click', refresh);
  $('csv-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (f) ingest(await f.text());
  });

  function showMain() {
    $('setup').hidden = true;
    $('main').hidden = false;
    renderRealInputs();
    render();
    refresh();
  }

  W.startCountdown();
  if (st.csvUrl) showMain(); else $('setup').hidden = false;
  setInterval(() => { if (!$('main').hidden && st.csvUrl) refresh(); }, 60000);
})();
