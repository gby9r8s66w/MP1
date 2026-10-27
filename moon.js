const Moon = (() => {
  const SYNODIC = 29.530588853;
  const EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14, 0);  // known new moon
  const rad = d => d * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;
  const norm = d => ((d % 360) + 360) % 360;

  const ageAt = date => { let a = ((date.getTime() - EPOCH_MS) / 86400000) % SYNODIC; return a < 0 ? a + SYNODIC : a; };
  const illumOf = age => (1 - Math.cos(2 * Math.PI * age / SYNODIC)) / 2;

  function phaseName(age) {
    const S = SYNODIC;
    if (age < 1.0 || age > S - 1.0) return 'NEW MOON';
    if (age < S * .25 - 1.2) return 'WAXING CRESCENT';
    if (age < S * .25 + 1.2) return 'FIRST QUARTER';
    if (age < S * .5 - 1.2) return 'WAXING GIBBOUS';
    if (age < S * .5 + 1.2) return 'FULL MOON';
    if (age < S * .75 - 1.2) return 'WANING GIBBOUS';
    if (age < S * .75 + 1.2) return 'LAST QUARTER';
    return 'WANING CRESCENT';
  }

  /* Low-precision Sun (Astronomical Almanac) -> RA/Dec in degrees */
  function sunEq(date) {
    const n = date.getTime() / 86400000 - 10957.5; // days since J2000
    const g = rad(norm(357.528 + 0.9856003 * n));
    const lam = rad(norm(280.460 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)));
    const eps = rad(23.439 - 0.0000004 * n);
    return { raDeg: norm(deg(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)))), decDeg: deg(Math.asin(Math.sin(eps) * Math.sin(lam))) };
  }

  /* Low-precision Moon (Duffett-Smith) -> RA/Dec in degrees */
  function moonEq(date) {
    const n = date.getTime() / 86400000 - 10957.5;
    const M = rad(norm(134.963 + 13.064993 * n));
    const F = rad(norm(93.272 + 13.229350 * n));
    const lam = rad(norm(218.316 + 13.176396 * n + 6.289 * Math.sin(M)));
    const beta = rad(5.128 * Math.sin(F));
    const eps = rad(23.439 - 0.0000004 * n);
    const dec = Math.asin(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lam));
    const ra = Math.atan2(Math.sin(lam) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lam));
    return { raDeg: norm(deg(ra)), decDeg: deg(dec) };
  }

  /* Equatorial -> horizontal (alt/az in radians) */
  function horizontal(raDeg, decDeg, date, latDeg, lonDeg) {
    const n = date.getTime() / 86400000 - 10957.5;
    const lst = norm(280.46061837 + 360.98564736629 * n + lonDeg);
    const H = rad(norm(lst - raDeg));
    const lat = rad(latDeg), dec = rad(decDeg);
    const alt = Math.asin(Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));
    return { alt, az };
  }

  /* Bearing from point a toward point b on the sky (0 = zenith). */
  function bearing(a, b) {
    const dAz = b.az - a.az;
    const y = Math.sin(dAz) * Math.cos(b.alt);
    const x = Math.cos(a.alt) * Math.sin(b.alt) - Math.sin(a.alt) * Math.cos(b.alt) * Math.cos(dAz);
    return Math.atan2(y, x);
  }

  function compute(date, latDeg, lonDeg) {
    const age = ageAt(date);
    let rollDeg = 0, degraded = false;
    try {
      const s = sunEq(date), m = moonEq(date);
      const hs = horizontal(s.raDeg, s.decDeg, date, latDeg, lonDeg);
      const hm = horizontal(m.raDeg, m.decDeg, date, latDeg, lonDeg);
      rollDeg = deg(bearing(hm, hs));
      if (!isFinite(rollDeg)) throw new Error('bad position');
    } catch (e) {
      const h = date.getHours() + date.getMinutes() / 60;
      rollDeg = 25 * Math.sin((h / 24) * 2 * Math.PI);
      degraded = true;
    }
    const untilFull = age < SYNODIC / 2 ? SYNODIC / 2 - age : SYNODIC * 1.5 - age;
    return {
      age, illum: illumOf(age), c: Math.cos(2 * Math.PI * age / SYNODIC), rollDeg, degraded,
      phaseName: phaseName(age),
      nextFull: new Date(date.getTime() + untilFull * 86400000),
      nextNew: new Date(date.getTime() + (SYNODIC - age) * 86400000)
    };
  }

  /* Lit region drawn with the sun "up"; group is rotated by roll. */
  function litPath(r, c) {
    const top = `M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`;
    if (Math.abs(c) < 0.02) return `${top} Z`;
    const e = (Math.abs(c) * r).toFixed(2);
    return `${top} A ${r} ${e} 0 0 ${c > 0 ? 0 : 1} ${-r} 0 Z`;
  }

  return { SYNODIC, compute, litPath };
})();
