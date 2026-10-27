const Store = (() => {
  const KEY = 'lunarpace.v1';
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  const defaults = () => ({
    plans: [],
    settings: { shortDays: 7, midDays: 30, longDays: 90, lat: 0, lon: 0, accent: 'volt' },
    streak: { count: 0, lastDone: null },
    seeded: false
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const d = defaults();
        return { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) }, streak: { ...d.streak, ...(p.streak || {}) } };
      }
    } catch (e) { /* corrupted state -> fresh start */ }
    return defaults();
  }

  let state = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  const localISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const deep = o => JSON.parse(JSON.stringify(o));

  return {
    get state() { return state; },
    uid, save,
    addPlan(p) {
      const plan = { id: uid(), title: p.title || '', createdAt: new Date().toISOString(), due: null, status: 'active', doneAt: null, tags: [], ...p };
      state.plans.unshift(plan); save(); return plan;
    },
    updatePlan(id, patch) { const p = state.plans.find(x => x.id === id); if (p) { Object.assign(p, patch); save(); } },
    removePlan(id) { state.plans = state.plans.filter(x => x.id !== id); save(); },
    streakOnDone() {
      const t = localISO(new Date());
      if (state.streak.lastDone === t) return;
      const y = new Date(); y.setDate(y.getDate() - 1);
      state.streak.count = (state.streak.lastDone === localISO(y)) ? state.streak.count + 1 : 1;
      state.streak.lastDone = t; save();
    },
    streakCount() {
      if (!state.streak.lastDone) return 0;
      const t = localISO(new Date());
      const y = new Date(); y.setDate(y.getDate() - 1);
      if (state.streak.lastDone === t || state.streak.lastDone === localISO(y)) return state.streak.count;
      return 0;
    },
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(text) {
      const p = JSON.parse(text);
      if (!p || !Array.isArray(p.plans)) throw new Error('bad file');
      const d = defaults();
      state = { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) }, streak: { ...d.streak, ...(p.streak || {}) } };
      save();
    },
    clearAll() { state = defaults(); state.seeded = true; save(); },
    seed() {
      if (state.seeded) return;
      const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return localISO(x); };
      state.plans = [
        { id: uid(), title: 'Mobility + core block', createdAt: new Date().toISOString(), due: d(0), status: 'active', doneAt: null, tags: ['strength'] },
        { id: uid(), title: 'Interval run — 6×400m', createdAt: new Date().toISOString(), due: d(2), status: 'active', doneAt: null, tags: ['run'] },
        { id: uid(), title: 'Race day: 10K', createdAt: new Date().toISOString(), due: d(45), status: 'active', doneAt: null, tags: ['run', 'goal'] }
      ];
      state.seeded = true; save();
    }
  };
})();
