(() => {
  const $ = s => document.querySelector(s);
  const state = Store.state;
  let todayISO = localISO(new Date());

  /* ---------- date utils ---------- */
  function localISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function todayStart() { return parseISO(todayISO); }
  function daysUntil(iso) { return Math.round((parseISO(iso) - todayStart()) / 86400000); }
  function shiftISO(iso, n) { const d = iso ? parseISO(iso) : todayStart(); d.setDate(d.getDate() + n); return localISO(d); }
  const fmtShort = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();

  /* ---------- stars ---------- */
  function makeStars() {
    const el = $('#stars'), n = 90;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const size = (Math.random() * 1.8 + 0.6).toFixed(1);
      s.style.cssText = `left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 100).toFixed(2)}%;width:${size}px;height:${size}px;--d:${(2 + Math.random() * 4).toFixed(1)}s;--dl:${(Math.random() * 4).toFixed(1)}s`;
      el.appendChild(s);
    }
  }

  /* ---------- moon ---------- */
  function tickMoon() {
    const { lat, lon } = state.settings;
    const info = Moon.compute(new Date(), lat, lon);
    $('#moonLit').setAttribute('d', Moon.litPath(100, info.c));
    $('#moonRot').setAttribute('transform', `rotate(${info.rollDeg.toFixed(2)})`);
    $('#phaseName').textContent = info.phaseName;
    $('#statIllum').textContent = `${Math.round(info.illum * 100)}%`;
    $('#statDay').textContent = `${info.age.toFixed(1)} / ${Moon.SYNODIC.toFixed(1)}`;
    $('#statFull').textContent = fmtShort(info.nextFull);
    $('#statNew').textContent = fmtShort(info.nextNew);
    $('#coordNote').textContent = (lat || lon)
      ? `ROLL ${info.rollDeg.toFixed(0)}° · LAT ${lat.toFixed(1)} LON ${lon.toFixed(1)}${info.degraded ? ' · ESTIMATED' : ''}`
      : 'EQUATOR VIEW — SET YOUR COORDINATES IN SETTINGS FOR TRUE LUNAR ROLL';
    $('#moonSvg').setAttribute('aria-label', `${info.phaseName}, ${Math.round(info.illum * 100)} percent illuminated`);
  }

  /* ---------- horizons ---------- */
  function horizonOf(p) {
    if (!p.due) return 'anytime';
    const d = daysUntil(p.due), s = state.settings;
    if (d <= s.shortDays) return 'short';
    if (d <= s.midDays) return 'mid';
    return 'long';
  }
  function sections() {
    const s = state.settings;
    return [
      { key: 'short', label: 'SHORT', range: `0–${s.shortDays}D` },
      { key: 'mid', label: 'MID', range: `${s.shortDays + 1}–${s.midDays}D` },
      { key: 'long', label: 'LONG', range: `${s.midDays + 1}D+` },
      { key: 'anytime', label: 'ANYTIME', range: 'NO DATE' }
    ];
  }
  const dueSort = (a, b) => (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99');

  /* ---------- board ---------- */
  function dueChip(p) {
    const d = daysUntil(p.due);
    let cls = 'chip due', txt;
    if (d < 0) { cls += ' over'; txt = `${Math.abs(d)}D OVER`; }
    else if (d === 0) { cls += ' today'; txt = 'TODAY'; }
    else txt = `D-${d}`;
    return `<span class="${cls}">${txt}</span>`;
  }

  function planEl(p) {
    const el = document.createElement('article');
    el.className = 'plan' + (p.status === 'done' ? ' done' : '') + (p.due && daysUntil(p.due) < 0 && p.status === 'active' ? ' overdue' : '');
    el.dataset.id = p.id;
    const chips = [];
    if (p.due) {
      chips.push(p.status === 'done' ? `<span class="chip date">${fmtShort(parseISO(p.due))}</span>` : dueChip(p));
    } else chips.push('<span class="chip date">ANYTIME</span>');
    p.tags.forEach(t => chips.push(`<span class="chip tag">#${t}</span>`));
    el.innerHTML = `
      <button class="check" data-act="toggle" aria-label="Toggle done">✔</button>
      <div class="plan-main">
        <div class="plan-title" title="Click to edit">${p.title}</div>
        <div class="plan-meta">${chips.join('')}</div>
      </div>
      <div class="plan-tools">
        <button class="tool" data-act="minus" title="One day earlier">−1D</button>
        <button class="tool" data-act="plus" title="One day later">+1D</button>
        <button class="tool" data-act="add3">+3D</button>
        <button class="tool" data-act="add7">+7D</button>
        <button class="tool del" data-act="del" title="Delete">✕</button>
      </div>`;
    return el;
  }

  function renderBoard() {
    const board = $('#board');
    board.textContent = '';
    const by = { short: [], mid: [], long: [], anytime: [] };
    state.plans.forEach(p => by[horizonOf(p)].push(p));
    for (const k in by) by[k].sort((a, b) => (a.status === b.status) ? dueSort(a, b) : (a.status === 'done' ? 1 : -1));

    for (const sec of sections()) {
      const plans = by[sec.key];
      const done = plans.filter(p => p.status === 'done').length;
      const pct = plans.length ? Math.round(done / plans.length * 100) : 0;
      const secEl = document.createElement('section');
      secEl.className = 'section';
      secEl.innerHTML = `
        <header class="section-head">
          <h2>${sec.label}</h2>
          <span class="range">${sec.range}</span>
          <span class="count">${done}/${plans.length}</span>
          ${done > 0 ? `<button class="linkbtn" data-clear="${sec.key}">CLEAR ✓${done}</button>` : ''}
        </header>
        <div class="stripe"><div class="stripe-fill" style="width:${pct}%"></div></div>`;
      const cards = document.createElement('div');
      cards.className = 'cards';
      if (!plans.length) cards.innerHTML = '<div class="empty">NO PLAYS HERE — CALL ONE ABOVE</div>';
      else plans.forEach(p => cards.appendChild(planEl(p)));
      secEl.appendChild(cards);
      board.appendChild(secEl);
    }
    renderToday();
  }

  function renderToday() {
    const items = state.plans
      .filter(p => p.due && p.status === 'active' && daysUntil(p.due) <= 0)
      .sort(dueSort);
    $('#todayStrip').classList.toggle('hidden', !items.length);
    const list = $('#todayList');
    list.textContent = '';
    items.forEach(p => {
      const d = document.createElement('div');
      d.className = 'today-item';
      const over = daysUntil(p.due) < 0 ? `<span class="over">+${-daysUntil(p.due)}D OVER</span>` : '';
      d.innerHTML = `<button class="check" data-toggle="${p.id}">✔</button><span class="ti-title">${p.title}</span>${over}`;
      list.appendChild(d);
    });
  }

  function renderHeader() {
    $('#todayDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
    const c = Store.streakCount();
    $('#streak').innerHTML = `STREAK <b>${String(c).padStart(2, '0')}</b> <span class="marks">${'▮'.repeat(Math.min(c, 7))}</span>`;
  }
  const renderAll = () => { renderHeader(); renderBoard(); };

  /* ---------- commands ---------- */
  let msgTimer;
  function flash(msg, ok = true) {
    const el = $('#cmdMsg');
    el.textContent = msg;
    el.classList.toggle('err', !ok);
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { el.textContent = ''; }, 4500);
  }

  function cmdAdd(text) {
    let days = null, hz = null; const tags = [], words = [];
    for (const tok of text.split(/\s+/)) {
      let m = tok.match(/^\+(\d+)d$/i);
      if (m) { days = +m[1]; continue; }
      m = tok.match(/^@(short|mid|long|anytime)$/i);
      if (m) { hz = m[1].toLowerCase(); continue; }
      m = tok.match(/^#([A-Za-z0-9_-]+)$/);
      if (m) { tags.push(m[1]); continue; }
      words.push(tok);
    }
    const title = words.join(' ').trim();
    if (!title) return 'NOTHING TO ADD — GIVE IT A NAME';
    let due = null;
    if (days != null) due = shiftISO(todayISO, days);
    else if (hz === 'short') due = shiftISO(todayISO, 1);
    else if (hz === 'mid') due = shiftISO(todayISO, state.settings.shortDays + 1);
    else if (hz === 'long') due = shiftISO(todayISO, state.settings.midDays + 1);
    Store.addPlan({ title, due, tags });
    renderAll();
    return `ADDED ▸ ${title.toUpperCase()}${due ? ' · DUE ' + fmtShort(parseISO(due)) : ' · ANYTIME'}`;
  }

  function findByQuery(q) {
    q = q.toLowerCase();
    return state.plans.find(p => p.status === 'active' && p.title.toLowerCase().includes(q));
  }
  function cmdDone(q) {
    const p = findByQuery(q);
    if (!p) return `NO MATCH FOR "${q}"`;
    Store.updatePlan(p.id, { status: 'done', doneAt: new Date().toISOString() });
    Store.streakOnDone();
    renderAll();
    return `DONE ✓ ${p.title.toUpperCase()}`;
  }
  function cmdDrop(q) {
    const p = findByQuery(q);
    if (!p) return `NO MATCH FOR "${q}"`;
    Store.removePlan(p.id);
    renderAll();
    return `DROPPED ✕ ${p.title.toUpperCase()}`;
  }
  function cmdSet(rest) {
    const toks = rest.trim().split(/\s+/);
    let changed = false;
    for (let i = 0; i < toks.length - 1; i += 2) {
      const k = toks[i].toLowerCase(), v = Number(toks[i + 1]);
      if (!isFinite(v)) return `BAD VALUE FOR ${k.toUpperCase()}`;
      if (k === 'short' && v >= 1) { state.settings.shortDays = Math.round(v); changed = true; }
      else if (k === 'mid' && v >= 2) { state.settings.midDays = Math.round(v); changed = true; }
      else if (k === 'long' && v >= 3) { state.settings.longDays = Math.round(v); changed = true; }
      else if (k === 'lat') { state.settings.lat = Math.max(-90, Math.min(90, v)); changed = true; }
      else if (k === 'lon') { state.settings.lon = Math.max(-180, Math.min(180, v)); changed = true; }
      else return `CAN'T SET "${k}"`;
    }
    if (!changed) return 'USAGE: /set short 7 mid 30 long 90 lat 48.2 lon 16.4';
    Store.save(); syncSettingsInputs(); renderAll(); tickMoon();
    return 'SETTINGS UPDATED';
  }

  function runCommand(raw) {
    const text = raw.trim();
    if (!text) return;
    if (text === '/help') { openOverlay('helpOverlay'); return; }
    if (/^\/set\b/i.test(text)) return cmdSet(text.slice(4));
    if (/^done\b/i.test(text)) return cmdDone(text.replace(/^done\s*/i, ''));
    if (/^(drop|del|delete)\b/i.test(text)) return cmdDrop(text.replace(/^\S+\s*/, ''));
    return cmdAdd(text);
  }

  /* ---------- editing ---------- */
  function editTitle(el, p) {
    if (el.querySelector('input')) return;
    const input = document.createElement('input');
    input.className = 'title-input';
    input.value = p.title;
    input.maxLength = 120;
    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();
    let doneFlag = false;
    const commit = () => {
      if (doneFlag) return; doneFlag = true;
      const v = input.value.trim();
      if (v) Store.updatePlan(p.id, { title: v });
      renderBoard();
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') { doneFlag = true; renderBoard(); }
    });
    input.addEventListener('blur', commit);
  }

  document.addEventListener('click', e => {
    const tg = e.target.closest('[data-toggle]');
    if (tg) {
      Store.updatePlan(tg.dataset.toggle, { status: 'active', doneAt: null });
      renderAll(); return;
    }
    const clearBtn = e.target.closest('[data-clear]');
    if (clearBtn) {
      const key = clearBtn.dataset.clear;
      state.plans = state.plans.filter(p => p.status !== 'done' || horizonOf(p) !== key);
      Store.save(); renderBoard(); return;
    }
    const actBtn = e.target.closest('[data-act]');
    if (!actBtn) return;
    const card = e.target.closest('.plan');
    const p = state.plans.find(x => x.id === card.dataset.id);
    if (!p) return;
    switch (actBtn.dataset.act) {
      case 'toggle':
        if (p.status === 'active') {
          Store.updatePlan(p.id, { status: 'done', doneAt: new Date().toISOString() });
          Store.streakOnDone();
        } else Store.updatePlan(p.id, { status: 'active', doneAt: null });
        renderAll();
        break;
      case 'minus': Store.updatePlan(p.id, { due: shiftISO(p.due, -1) }); renderAll(); break;
      case 'plus':  Store.updatePlan(p.id, { due: shiftISO(p.due, 1) });  renderAll(); break;
      case 'add3':  Store.updatePlan(p.id, { due: shiftISO(p.due, 3) });  renderAll(); break;
      case 'add7':  Store.updatePlan(p.id, { due: shiftISO(p.due, 7) });  renderAll(); break;
      case 'del':   Store.removePlan(p.id); renderAll(); break;
    }
  });

  document.addEventListener('dblclick', e => {
    const title = e.target.closest('.plan-title');
    if (title) editTitle(title, state.plans.find(p => p.id === title.closest('.plan').dataset.id));
  });

  /* ---------- overlays & settings ---------- */
  function openOverlay(id) { $('#' + id).classList.remove('hidden'); }
  function closeOverlay(id) { $('#' + id).classList.add('hidden'); }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.overlay:not(.hidden)').forEach(o => o.classList.add('hidden'));
  });
  document.querySelectorAll('.overlay').forEach(ov => ov.addEventListener('click', e => { if (e.target === ov) ov.classList.add('hidden'); }));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeOverlay(b.dataset.close)));
  $('#btnHelp').addEventListener('click', () => openOverlay('helpOverlay'));
  $('#btnSettings').addEventListener('click', () => { syncSettingsInputs(); openOverlay('settingsOverlay'); });

  function syncSettingsInputs() {
    const s = state.settings;
    $('#setShort').value = s.shortDays; $('#setMid').value = s.midDays; $('#setLong').value = s.longDays;
    $('#setLat').value = s.lat; $('#setLon').value = s.lon;
    document.querySelectorAll('.accent-chip').forEach(c => c.classList.toggle('active', c.dataset.accent === (s.accent || 'volt')));
  }
  function applyAccent() { document.documentElement.dataset.accent = state.settings.accent || 'volt'; }

  [['setShort', 'shortDays', 1, 365], ['setMid', 'midDays', 2, 730], ['setLong', 'longDays', 3, 3650]].forEach(([id, key, min, max]) => {
    $('#' + id).addEventListener('change', e => {
      const v = Math.round(Number(e.target.value));
      if (isFinite(v) && v >= min && v <= max) { state.settings[key] = v; Store.save(); renderAll(); }
      else e.target.value = state.settings[key];
    });
  });
  [['setLat', 'lat', -90, 90], ['setLon', 'lon', -180, 180]].forEach(([id, key, min, max]) => {
    $('#' + id).addEventListener('change', e => {
      const v = Number(e.target.value);
      if (isFinite(v)) { state.settings[key] = Math.max(min, Math.min(max, v)); Store.save(); tickMoon(); }
      else e.target.value = state.settings[key];
    });
  });
  document.querySelectorAll('.accent-chip').forEach(c => c.addEventListener('click', () => {
    state.settings.accent = c.dataset.accent; Store.save(); applyAccent(); syncSettingsInputs();
  }));

  $('#btnExport').addEventListener('click', () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lunarpace-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#btnImport').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { Store.importJSON(String(r.result)); applyAccent(); tickMoon(); renderAll(); syncSettingsInputs(); $('#settingsMsg').textContent = 'IMPORT COMPLETE'; }
      catch (err) { $('#settingsMsg').textContent = 'IMPORT FAILED — BAD FILE'; }
    };
    r.readAsText(f);
    e.target.value = '';
  });
  $('#btnClearDone').addEventListener('click', () => {
    state.plans = state.plans.filter(p => p.status !== 'done');
    Store.save(); renderBoard(); $('#settingsMsg').textContent = 'COMPLETED PLANS CLEARED';
  });
  $('#btnReset').addEventListener('click', () => {
    if (confirm('Reset LUNARPACE? All plans and settings will be wiped.')) {
      Store.clearAll(); applyAccent(); tickMoon(); renderAll(); syncSettingsInputs();
      $('#settingsMsg').textContent = 'RESET COMPLETE';
    }
  });

  /* ---------- input wiring ---------- */
  function submitCommand() {
    const input = $('#cmdInput');
    const msg = runCommand(input.value);
    input.value = '';
    const box = $('.cmd-box');
    box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse');
    if (msg) flash(msg);
    input.focus();
  }
  $('#cmdInput').addEventListener('keydown', e => { if (e.key === 'Enter') submitCommand(); });
  $('#cmdGo').addEventListener('click', submitCommand);

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  /* ---------- init ---------- */
  Store.seed();
  applyAccent();
  makeStars();
  tickMoon();
  renderAll();
  $('#cmdInput').focus();
  setInterval(tickMoon, 60000);
  setInterval(() => {
    const t = localISO(new Date());
    if (t !== todayISO) { todayISO = t; renderAll(); }
  }, 30000);
})();
