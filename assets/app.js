// Player page: name -> bet -> send -> share. Also renders a shared bet (#v=name~bet).
(function () {
  const C = window.WINNER, W = window.W;
  const N = C.PARTIES.length, TOTAL = C.TOTAL, KEY = 'winner2026';
  const $ = (id) => document.getElementById(id);
  const ALL = C.PARTIES.map((_, i) => i);
  const baseUrl = location.origin + location.pathname;

  const saved = W.load(KEY) || {};
  const state = {
    name: typeof saved.name === 'string' ? saved.name : '',
    bet: Array.isArray(saved.bet) && saved.bet.length === N ? saved.bet : new Array(N).fill(0),
    sent: saved.sent && W.validBet(saved.sent.bet) ? saved.sent : null
  };
  const persist = () => W.save(KEY, state);
  let sending = false;

  function show(id) {
    ['s-name', 's-bet', 's-sent', 's-view'].forEach((s) => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }
  function drawPie(svgId, lgId, vals, empty) {
    const b = W.blocSums(vals);
    W.donut($(svgId), b, { c: 66, r0: 40, r1: 58, gap: 2, tick: true });
    $(lgId).innerHTML = W.legendHTML(b, false, { empty, note: true });
  }
  function shareText(name, vals) {
    const parties = W.byValueDesc(vals).filter((i) => vals[i] > 0)
      .map((i) => C.PARTIES[i].name + ' ' + vals[i]).join(', ');
    return '🗳️ Winner בחירות 2026 · המדגם של ' + name + '\n' +
      W.blocText(vals) + '\n' + parties + '\n\n' +
      'לגרף המלא: ' + viewUrl(name, vals) + '\n' +
      'להמר בעצמכם עד 22:00: ' + baseUrl;
  }
  const viewUrl = (name, vals) => baseUrl + '#v=' + encodeURIComponent(name) + '~' + W.encodeBet(vals);

  // ---------- name ----------
  function showName() {
    const closed = W.isClosed();
    $('name').value = state.name;
    $('name-form').hidden = closed;
    $('closed-name').hidden = !closed;
    show('s-name');
  }
  $('name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('name').value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) { $('name').focus(); return; }
    state.name = name;
    persist();
    showBet();
  });

  // ---------- bet ----------
  function renderBet() {
    const total = W.sum(state.bet), closed = W.isClosed();
    $('bet-name').textContent = 'של ' + state.name;
    $('bet-total').textContent = total;
    drawPie('pie-bet', 'lg-bet', state.bet, true);
    $('list').innerHTML = W.rowsHTML(state.bet, ALL, { editable: true });
    if (closed) $('list').querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const st = $('status');
    if (closed) { st.className = 'status err'; st.textContent = 'הקלפיות נסגרו, אי אפשר לשלוח יותר הימורים'; }
    else if (total < TOTAL) { st.className = 'status'; st.textContent = 'חסרים ' + (TOTAL - total) + ' מנדטים כדי לשלוח'; }
    else { st.className = 'status ok'; st.textContent = '✓ 120 מנדטים, מוכן לשליחה'; }
    $('send').disabled = closed || sending || total !== TOTAL;
    $('reset').hidden = closed;
  }
  function showBet() { renderBet(); show('s-bet'); }

  $('list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-i]');
    if (!btn || W.isClosed()) return;
    const i = +btn.dataset.i, d = +btn.dataset.d, v = state.bet[i];
    const left = TOTAL - W.sum(state.bet);
    let next;
    if (d > 0) {
      next = v === 0 ? C.MIN_SEATS : v + 1;
      if (next - v > left) {
        $('status').className = 'status err';
        $('status').textContent = left ? 'נשארו רק ' + left + ' מנדטים, ומפלגה חדשה צריכה לפחות ' + C.MIN_SEATS : 'כל 120 המנדטים חולקו';
        return;
      }
    } else {
      if (v === 0) return;
      next = v <= C.MIN_SEATS ? 0 : v - 1;
    }
    state.bet[i] = next;
    persist();
    renderBet();
  });
  $('reset').addEventListener('click', () => {
    if (!confirm('לאפס את כל המנדטים?')) return;
    state.bet = new Array(N).fill(0);
    persist();
    renderBet();
  });
  $('change-name').addEventListener('click', showName);

  $('send').addEventListener('click', async () => {
    if (sending || W.isClosed() || !W.validBet(state.bet)) return;
    sending = true;
    renderBet();
    $('send').textContent = 'שולח...';
    try {
      if (C.FORM_ID) {
        const body = new URLSearchParams();
        body.append(C.ENTRY_NAME, state.name);
        body.append(C.ENTRY_BET, W.encodeBet(state.bet));
        // Google Forms does not send CORS headers; an opaque response means it was delivered.
        await fetch('https://docs.google.com/forms/d/e/' + C.FORM_ID + '/formResponse', { method: 'POST', mode: 'no-cors', body });
      }
      state.sent = { bet: state.bet.slice(), at: Date.now() };
      persist();
      showSent();
    } catch (err) {
      $('status').className = 'status err';
      $('status').textContent = 'השליחה נכשלה. בדקו את החיבור לאינטרנט ונסו שוב.';
    } finally {
      sending = false;
      $('send').textContent = 'שליחת ההימור';
      if (!$('s-bet').hidden) renderBet();
    }
  });

  // ---------- sent ----------
  function showSent() {
    const vals = state.sent.bet, closed = W.isClosed();
    $('sent-sub').textContent = closed
      ? 'זה ההימור האחרון ששלחת, ' + state.name + '. נתראה בתוצאות!'
      : 'ההימור של ' + state.name + ' נשמר. אפשר לשנות אותו עד 22:00, ונספר ההימור האחרון שנשלח.';
    $('test-mode').hidden = !!C.FORM_ID;
    drawPie('pie-sent', 'lg-sent', vals, false);
    $('list-sent').innerHTML = W.rowsHTML(vals, W.byValueDesc(vals).filter((i) => vals[i] > 0), {});
    $('edit').hidden = closed;
    $('share-status').textContent = '';
    show('s-sent');
  }
  $('share-wa').addEventListener('click', () => W.shareWhatsApp(shareText(state.name, state.sent.bet)));
  $('share-other').addEventListener('click', async () => {
    const r = await W.shareOther(shareText(state.name, state.sent.bet));
    $('share-status').textContent = r === 'copied' ? 'הטקסט הועתק, אפשר להדביק' : r === 'failed' ? 'לא הצלחתי לשתף' : '';
  });
  $('edit').addEventListener('click', () => {
    state.bet = state.sent.bet.slice();
    persist();
    showBet();
  });

  // ---------- shared bet view ----------
  function parseView() {
    const m = location.hash.match(/^#v=(.*)~([\d-]+)$/);
    if (!m) return null;
    let name;
    try { name = decodeURIComponent(m[1]); } catch (e) { return null; }
    const bet = W.decodeBet(m[2]);
    return bet && name ? { name, bet } : null;
  }
  function showView(v) {
    $('view-name').textContent = 'של ' + v.name;
    drawPie('pie-view', 'lg-view', v.bet, false);
    $('list-view').innerHTML = W.rowsHTML(v.bet, W.byValueDesc(v.bet).filter((i) => v.bet[i] > 0), {});
    $('mine').textContent = W.isClosed() ? 'למשחק' : 'גם אני רוצה להמר';
    show('s-view');
  }
  $('mine').addEventListener('click', () => {
    history.replaceState(null, '', baseUrl);
    start();
  });

  // ---------- start ----------
  function onClose() {
    $('ticker').innerHTML = '<em>מבזק</em>הקלפיות נסגרו · מחכים לתוצאות האמת';
    if (!$('s-bet').hidden) renderBet();
    else if (!$('s-sent').hidden) showSent();
    else if (!$('s-name').hidden) showName();
  }
  function start() {
    const v = parseView();
    if (v) return showView(v);
    if (W.isClosed()) return state.sent && state.name ? showSent() : showName();
    if (!state.name) return showName();
    showBet();
  }
  if (W.isClosed()) $('ticker').innerHTML = '<em>מבזק</em>הקלפיות נסגרו · מחכים לתוצאות האמת';
  window.addEventListener('hashchange', start);
  W.startCountdown(onClose);
  start();
})();
