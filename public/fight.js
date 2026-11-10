// fight.js — 순수 게임 로직 (렌더링과 분리되어 있어 Node에서도 테스트 가능)

export const RING_HALF = 2.7;      // 링 반 너비(m)
export const MIN_DIST = 0.62;      // 두 선수 최소 거리
export const ROUND_TIME = 90;      // 라운드 시간(초)
export const MAX_ROUNDS = 3;

// kind: straight / hook / upper / feint,  target: head / body
export const MOVES = {
  jab:    { label: '잽',            hand: 'L', kind: 'straight', target: 'head', startup: 0.09, active: 0.07, recovery: 0.16, dmg: 4,  stam: 3,  reach: 1.20, stun: 0.12, stamDmg: 1 },
  cross:  { label: '스트레이트',     hand: 'R', kind: 'straight', target: 'head', startup: 0.14, active: 0.08, recovery: 0.25, dmg: 8,  stam: 6,  reach: 1.28, stun: 0.22, stamDmg: 2 },
  lhook:  { label: '레프트 훅',      hand: 'L', kind: 'hook',     target: 'head', startup: 0.17, active: 0.08, recovery: 0.29, dmg: 10, stam: 8,  reach: 1.05, stun: 0.30, stamDmg: 2 },
  rhook:  { label: '라이트 훅',      hand: 'R', kind: 'hook',     target: 'head', startup: 0.19, active: 0.08, recovery: 0.31, dmg: 11, stam: 9,  reach: 1.05, stun: 0.32, stamDmg: 2 },
  lupper: { label: '레프트 어퍼컷',  hand: 'L', kind: 'upper',    target: 'head', startup: 0.20, active: 0.08, recovery: 0.33, dmg: 12, stam: 9,  reach: 0.95, stun: 0.40, stamDmg: 2 },
  rupper: { label: '라이트 어퍼컷',  hand: 'R', kind: 'upper',    target: 'head', startup: 0.22, active: 0.08, recovery: 0.35, dmg: 13, stam: 10, reach: 0.95, stun: 0.42, stamDmg: 2 },
  bjab:   { label: '바디 잽',        hand: 'L', kind: 'straight', target: 'body', startup: 0.10, active: 0.07, recovery: 0.18, dmg: 3,  stam: 3,  reach: 1.15, stun: 0.08, stamDmg: 6 },
  bcross: { label: '바디 스트레이트', hand: 'R', kind: 'straight', target: 'body', startup: 0.15, active: 0.08, recovery: 0.27, dmg: 6,  stam: 6,  reach: 1.20, stun: 0.15, stamDmg: 10 },
  lbody:  { label: '레프트 바디훅',  hand: 'L', kind: 'hook',     target: 'body', startup: 0.17, active: 0.08, recovery: 0.30, dmg: 8,  stam: 8,  reach: 1.00, stun: 0.25, stamDmg: 14 },
  rbody:  { label: '라이트 바디훅',  hand: 'R', kind: 'hook',     target: 'body', startup: 0.19, active: 0.08, recovery: 0.32, dmg: 9,  stam: 9,  reach: 1.00, stun: 0.27, stamDmg: 15 },
  feint:  { label: '페인트',         hand: 'L', kind: 'feint',    target: 'none', startup: 0.12, active: 0.00, recovery: 0.10, dmg: 0,  stam: 1,  reach: 0,    stun: 0,    stamDmg: 0 },
};

// 숙인 상태(C)에서 누르면 바디샷으로 바뀜
export const BODY_VERSION = { jab: 'bjab', cross: 'bcross', lhook: 'lbody', rhook: 'rbody' };

// win: 회피 판정이 유효한 구간(초)
export const EVADES = {
  slipL: { label: '슬립',   dur: 0.36, win: [0.02, 0.26], avoids: { straight: true }, stam: 3 },
  slipR: { label: '슬립',   dur: 0.36, win: [0.02, 0.26], avoids: { straight: true }, stam: 3 },
  weave: { label: '위빙',   dur: 0.62, win: [0.06, 0.48], avoids: { straight: true, hook: true }, stam: 5 },
  lean:  { label: '스웨이', dur: 0.45, win: [0.02, 0.32], avoids: { hook: true, upper: true }, stam: 3, back: 0.32 },
  parry: { label: '패리',   dur: 0.30, win: [0.00, 0.20], avoids: {}, stam: 2 },
};

export const DIFFICULTY = {
  easy:   { label: '쉬움',   defend: 0.25, react: [0.08, 0.20], interval: [1.4, 2.6], slow: 1.40, tell: 0.32, dmgMul: 0.80, guard: 0.35, smart: 0.50, hp: 105 },
  normal: { label: '보통',   defend: 0.45, react: [0.05, 0.14], interval: [0.9, 1.8], slow: 1.20, tell: 0.22, dmgMul: 1.00, guard: 0.55, smart: 0.70, hp: 120 },
  hard:   { label: '어려움', defend: 0.62, react: [0.03, 0.10], interval: [0.5, 1.2], slow: 1.05, tell: 0.14, dmgMul: 1.15, guard: 0.70, smart: 0.88, hp: 135 },
};

const COMBOS = [
  ['jab'], ['jab', 'jab'], ['jab', 'cross'], ['jab', 'cross', 'lhook'], ['cross', 'lhook', 'cross'],
  ['lbody', 'lhook'], ['jab', 'rbody'], ['lhook', 'rupper'], ['jab', 'jab', 'cross', 'lhook'],
  ['bjab', 'cross'], ['rupper', 'lhook'], ['feint', 'cross'], ['jab', 'lbody', 'lhook'],
];
const COUNTERS = [['cross'], ['lhook'], ['rupper'], ['cross', 'lhook'], ['lhook', 'rhook']];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function dist(a, b) { return Math.hypot(b.x - a.x, b.z - a.z); }

export function makeFighter(name, x, z, opts = {}) {
  const hp = opts.hp || 100;
  return {
    name, x, z, vx: 0, vz: 0,
    hp, maxHp: hp, stam: 100,
    guard: false, crouch: false,
    act: null, evade: null, stun: 0,
    flinch: 0, flinchKind: null, flinchSide: 0,
    down: false, kd: 0, actSeq: 0, counterT: 0, getUp: 0,
    slow: opts.slow || 1, dmgMul: opts.dmgMul || 1, tell: opts.tell || 0,
    stats: { thrown: 0, landed: 0, dmg: 0, blocked: 0, evaded: 0 },
    roundDmg: 0, walk: 0,
  };
}

function newBrain(D) {
  return {
    fwd: 0, strafe: 0, strafeDir: 1, strafeT: 1, range: 1.1,
    nextAtk: rand(...D.interval) + 0.6, combo: [], comboGap: 0, first: true,
    react: null, reactedKey: -1, punishKey: -1, counterReady: false,
    duckT: 0, guardT: 0, backT: 0, wantGuard: Math.random() < D.guard,
  };
}

export function makeGame(difficulty = 'normal') {
  const D = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const player = makeFighter('YOU', 0, 1.4, { hp: 120 });
  const ai = makeFighter('IRON KIM', 0, -1.4, { hp: D.hp, slow: D.slow, dmgMul: D.dmgMul, tell: D.tell });
  ai.brain = newBrain(D);
  const g = {
    player, ai, difficulty, D,
    round: 1, timer: ROUND_TIME, state: 'intro', stateT: 0,
    count: 0, downed: null, mash: 0, mashNeed: 0, tko: false,
    scores: { p: [], a: [] }, roundKD: { p: 0, a: 0 },
    winner: null, result: '', time: 0, buffer: [], events: [],
  };
  emit(g, { type: 'roundStart', round: 1 });
  return g;
}

function emit(g, e) { g.events.push(e); }
const other = (g, f) => (f === g.player ? g.ai : g.player);

export function canPunch(f) {
  if (f.down || f.stun > 0 || f.act) return false;
  if (f.evade && f.evade.t < EVADES[f.evade.type].win[1]) return false;
  return true;
}
export function canEvade(f) {
  if (f.down || f.stun > 0 || f.evade) return false;
  if (f.act && f.act.phase !== 'recovery' && f.act.id !== 'feint') return false;
  return true;
}
const canGuard = (f) => f.stun <= 0 && !f.act && !f.down;

export function startPunch(g, f, id, windup = 0) {
  const m = MOVES[id];
  const tired = f.stam < m.stam;
  f.stam = Math.max(0, f.stam - m.stam);
  const slow = f.slow * (tired ? 1.35 : 1);
  f.act = {
    id, t: 0, w: windup, s: m.startup * slow, a: m.active, r: m.recovery * (tired ? 1.2 : 1),
    phase: windup > 0 ? 'windup' : 'startup', hit: false,
    power: (0.65 + 0.35 * f.stam / 100) * (tired ? 0.7 : 1) * f.dmgMul,
    key: ++f.actSeq,
  };
  f.guard = false;
  if (m.kind !== 'feint') f.stats.thrown++;
  emit(g, { type: 'swing', who: f, id });
}

export function startEvade(g, f, type, dir = 1) {
  const e = EVADES[type];
  if (f.act) f.act = null; // 펀치 회복 동작을 캔슬
  f.stam = Math.max(0, f.stam - e.stam);
  f.evade = { type, t: 0, dur: e.dur, dir };
  f.guard = false;
  emit(g, { type: 'evadeStart', who: f, evade: type });
}

function inWindow(ev) {
  const w = EVADES[ev.type].win;
  return ev.t >= w[0] && ev.t <= w[1];
}

// ------------------------------------------------------------ 타격 판정
function resolve(g, att, def) {
  const A = att.act; const m = MOVES[A.id];
  if (def.down) return;
  const ev = def.evade && inWindow(def.evade) ? def.evade.type : null;
  let effD = dist(att, def);
  if (ev === 'lean') effD += m.target === 'head' ? EVADES.lean.back : 0.12;

  if (effD > m.reach) { emit(g, { type: 'miss', att, def, id: A.id }); return; }

  // 패리: 머리로 오는 스트레이트를 쳐내고 상대를 무너뜨림
  if (ev === 'parry' && m.target === 'head' && m.kind === 'straight') {
    att.act = null; att.stun = 0.55; def.counterT = 0.7;
    if (def.brain) def.brain.counterReady = true;
    emit(g, { type: 'parry', att, def, id: A.id });
    return;
  }
  if (m.target === 'head') {
    const ducked = def.crouch && (m.kind === 'straight' || m.kind === 'hook');
    if ((ev && EVADES[ev].avoids[m.kind]) || ducked) {
      def.counterT = 0.7; def.stats.evaded++;
      if (def.brain) def.brain.counterReady = true;
      emit(g, { type: 'evade', att, def, id: A.id, how: ducked ? 'duck' : ev });
      return;
    }
  }

  let dmg = m.dmg * A.power;
  const counter = !!((def.act && def.act.phase !== 'active' && MOVES[def.act.id].kind !== 'feint') || att.counterT > 0);
  if (counter) dmg *= 1.4;
  if (m.kind === 'upper' && def.crouch) dmg *= 1.5;
  att.counterT = 0;

  const blocked = def.guard && canGuard(def);
  if (blocked) {
    const mult = m.target === 'body' ? 0.55 : m.kind === 'upper' ? 0.55 : 0.15;
    dmg *= mult;
    def.stam = Math.max(0, def.stam - m.dmg * 0.7 - m.stamDmg * 0.4);
    def.stats.blocked++;
    push(def, att, 0.04);
  } else {
    def.stam = Math.max(0, def.stam - m.stamDmg);
    def.stun = m.stun * (counter ? 1.6 : 1);
    def.act = null; def.evade = null; def.guard = false;
    def.flinch = 1; def.flinchKind = m.kind; def.flinchSide = m.hand === 'L' ? 1 : -1;
    push(def, att, 0.05 + dmg * 0.006);
  }
  dmg = Math.round(dmg * 10) / 10;
  def.hp = Math.max(0, def.hp - dmg);
  att.stats.landed += blocked ? 0 : 1;
  att.stats.dmg += dmg; att.roundDmg += dmg;
  emit(g, { type: blocked ? 'block' : 'hit', att, def, id: A.id, dmg, counter: counter && !blocked, target: m.target });
  if (def.hp <= 0) knockdown(g, def);
}

function push(def, att, amt) {
  let dx = def.x - att.x, dz = def.z - att.z; const d = Math.hypot(dx, dz) || 1;
  def.x = clamp(def.x + dx / d * amt, -RING_HALF + 0.3, RING_HALF - 0.3);
  def.z = clamp(def.z + dz / d * amt, -RING_HALF + 0.3, RING_HALF - 0.3);
}

function knockdown(g, f) {
  f.down = true; f.hp = 0; f.kd++; f.act = null; f.evade = null; f.guard = false; f.crouch = false; f.stun = 0;
  g.state = 'count'; g.stateT = 0; g.count = 0; g.downed = f; g.mash = 0;
  g.mashNeed = 10 + (f.kd - 1) * 9;
  g.tko = f.kd >= 3;
  f.getUp = f === g.ai ? Math.min(9, 2 + f.kd * 2 + Math.floor(Math.random() * 3)) : 0;
  if (f === g.player) g.roundKD.p++; else g.roundKD.a++;
  g.buffer.length = 0;
  emit(g, { type: 'knockdown', who: f, kd: f.kd, tko: g.tko });
}

function getUp(g, f) {
  f.down = false;
  f.hp = Math.max(15, Math.round(f.maxHp * (0.55 - 0.12 * (f.kd - 1))));
  f.stam = Math.max(f.stam, 60);
  f.stun = 0.4;
  g.state = 'fight'; g.stateT = 0; g.downed = null;
  emit(g, { type: 'getup', who: f });
}

function finish(g, winnerKey, result) {
  g.state = 'over'; g.stateT = 0; g.winner = winnerKey; g.result = result;
  emit(g, { type: 'over', winner: winnerKey, result });
}

function endRound(g) {
  const p = g.player, a = g.ai;
  let ps = 10, as = 10;
  if (p.roundDmg > a.roundDmg * 1.05) as = 9; else if (a.roundDmg > p.roundDmg * 1.05) ps = 9;
  ps -= g.roundKD.p; as -= g.roundKD.a;
  g.scores.p.push(ps); g.scores.a.push(as);
  p.roundDmg = 0; a.roundDmg = 0; g.roundKD = { p: 0, a: 0 };
  p.act = a.act = null; p.evade = a.evade = null;
  emit(g, { type: 'bell' });
  if (g.round >= MAX_ROUNDS) {
    const tp = g.scores.p.reduce((s, v) => s + v, 0), ta = g.scores.a.reduce((s, v) => s + v, 0);
    finish(g, tp > ta ? 'player' : ta > tp ? 'ai' : 'draw', tp === ta ? '무승부' : '판정');
  } else {
    g.state = 'break'; g.stateT = 0;
    emit(g, { type: 'roundEnd', round: g.round });
  }
}

function resetPositions(g) {
  g.player.x = 0; g.player.z = 1.4; g.ai.x = 0; g.ai.z = -1.4;
  for (const f of [g.player, g.ai]) { f.vx = f.vz = 0; f.act = null; f.evade = null; f.stun = 0; }
}

// ------------------------------------------------------------ 매 프레임
function tickFighter(g, f, dt, live) {
  f.flinch = Math.max(0, f.flinch - dt * 3.5);
  f.counterT = Math.max(0, f.counterT - dt);
  if (f.down) return;
  if (f.stun > 0) f.stun = Math.max(0, f.stun - dt);
  const A = f.act;
  if (A) {
    A.t += dt;
    const e1 = A.w, e2 = e1 + A.s, e3 = e2 + A.a, e4 = e3 + A.r;
    const ph = A.t < e1 ? 'windup' : A.t < e2 ? 'startup' : A.t < e3 ? 'active' : A.t < e4 ? 'recovery' : 'done';
    if (!A.hit && A.a > 0 && ph !== 'windup' && ph !== 'startup') {
      A.hit = true;
      if (live) resolve(g, f, other(g, f));
    }
    if (f.act === A) { A.phase = ph; if (ph === 'done') f.act = null; }
  }
  if (f.evade) { f.evade.t += dt; if (f.evade.t >= f.evade.dur) f.evade = null; }
  const rate = f.act ? 0 : f.guard ? 5 : f.crouch ? 6 : 10;
  f.stam = clamp(f.stam + rate * dt, 0, 100);
}

function moveFighter(g, f, fwd, str, dt) {
  const o = other(g, f);
  let dx = o.x - f.x, dz = o.z - f.z; const d0 = Math.hypot(dx, dz) || 1; dx /= d0; dz /= d0;
  const rx = -dz, rz = dx;
  let sp = 1.9;
  if (f.guard) sp *= 0.7; if (f.crouch) sp *= 0.55; if (f.act) sp *= 0.35; if (f.evade) sp *= 0.5;
  if (f.stun > 0) sp *= 0.3; if (f.stam < 20) sp *= 0.8; if (f.down) sp = 0;
  const len = Math.hypot(fwd, str); if (len > 1) { fwd /= len; str /= len; }
  const tx = (dx * fwd + rx * str) * sp, tz = (dz * fwd + rz * str) * sp;
  const k = 1 - Math.exp(-dt * 14);
  f.vx += (tx - f.vx) * k; f.vz += (tz - f.vz) * k;
  f.x += f.vx * dt; f.z += f.vz * dt;
  // 순수 좌우 이동일 때는 상대 주위를 원으로 돌도록 거리 유지
  if (Math.abs(fwd) < 0.01 && Math.abs(str) > 0.01) {
    const nd = Math.hypot(f.x - o.x, f.z - o.z) || 1;
    f.x = o.x + (f.x - o.x) * d0 / nd; f.z = o.z + (f.z - o.z) * d0 / nd;
  }
  f.x = clamp(f.x, -RING_HALF + 0.3, RING_HALF - 0.3);
  f.z = clamp(f.z, -RING_HALF + 0.3, RING_HALF - 0.3);
  f.walk += Math.hypot(f.vx, f.vz) * dt;
}

function separate(g) {
  const p = g.player, a = g.ai;
  let dx = a.x - p.x, dz = a.z - p.z; const d = Math.hypot(dx, dz);
  if (d < MIN_DIST) {
    const n = d || 1, o = (MIN_DIST - d) / 2;
    dx = d ? dx / n : 0; dz = d ? dz / n : -1;
    p.x -= dx * o; p.z -= dz * o; a.x += dx * o; a.z += dz * o;
  }
}

function handleInput(g, dt, input) {
  const p = g.player;
  for (const ev of input.presses) g.buffer.push({ ...ev, age: 0 });
  p.guard = !!input.guard && canGuard(p);
  p.crouch = !!input.crouch && !p.down;
  for (const b of g.buffer) b.age += dt;
  g.buffer = g.buffer.filter((b) => b.age < 0.2);
  const item = g.buffer[0];
  if (!item) return;
  if (item.kind === 'punch' && canPunch(p)) {
    const id = p.crouch && BODY_VERSION[item.id] ? BODY_VERSION[item.id] : item.id;
    startPunch(g, p, id, 0); g.buffer.shift();
  } else if (item.kind === 'evade' && canEvade(p)) {
    startEvade(g, p, item.id, item.dir || 1); g.buffer.shift();
  }
}

// ------------------------------------------------------------ AI
function aiDefend(g, id) {
  const a = g.ai, b = a.brain, m = MOVES[id], D = g.D;
  const kind = m.kind === 'feint' ? 'straight' : m.kind;
  const options = m.target === 'body' ? ['guard', 'back']
    : kind === 'straight' ? ['slip', 'parry', 'guard', 'weave']
    : kind === 'hook' ? ['duck', 'weave', 'guard', 'lean'] : ['lean', 'guard'];
  const all = ['slip', 'parry', 'guard', 'weave', 'duck', 'lean', 'back'];
  const choice = Math.random() < D.smart ? pick(options) : pick(all);
  const tryEv = (t, dir) => { if (canEvade(a)) startEvade(g, a, t, dir); };
  switch (choice) {
    case 'slip': tryEv(Math.random() < 0.5 ? 'slipL' : 'slipR'); break;
    case 'parry': tryEv('parry'); break;
    case 'weave': tryEv('weave', Math.random() < 0.5 ? -1 : 1); break;
    case 'lean': tryEv('lean'); break;
    case 'duck': b.duckT = 0.45; break;
    case 'guard': b.guardT = 0.6; break;
    case 'back': b.backT = 0.35; b.guardT = 0.3; break;
  }
}

function aiThink(g, dt) {
  const a = g.ai, p = g.player, b = a.brain, D = g.D;
  const d = dist(a, p);
  b.duckT = Math.max(0, b.duckT - dt); b.guardT = Math.max(0, b.guardT - dt); b.backT = Math.max(0, b.backT - dt);

  // 반응 방어
  if (p.act && (p.act.phase === 'startup' || p.act.phase === 'windup') && p.act.key !== b.reactedKey) {
    b.reactedKey = p.act.key;
    const tired = a.stam < 20 ? 0.5 : 1;
    if (d < 1.5 && Math.random() < D.defend * tired) b.react = { t: rand(...D.react), id: p.act.id };
  }
  if (b.react) { b.react.t -= dt; if (b.react.t <= 0) { aiDefend(g, b.react.id); b.react = null; } }

  // 회피 성공 후 카운터
  if (b.counterReady) {
    b.counterReady = false;
    if (Math.random() < D.smart) { b.combo = pick(COUNTERS).slice(); b.first = false; b.comboGap = 0; }
  }

  // 공격
  if (!b.combo.length) {
    b.nextAtk -= dt * (a.stam < 25 ? 0.5 : 1);
    if (b.nextAtk <= 0 && d < 1.45) { b.combo = pick(COMBOS).slice(); b.first = true; b.nextAtk = rand(...D.interval); }
    else if (p.act && p.act.phase === 'recovery' && d < 1.25 && p.act.key !== b.punishKey) {
      b.punishKey = p.act.key;
      if (Math.random() < D.smart * 0.5) { b.combo = ['cross']; b.first = false; }
    }
  }
  if (b.combo.length) {
    b.comboGap -= dt;
    if (b.comboGap <= 0 && canPunch(a)) {
      const id = b.combo[0]; const reach = MOVES[id].reach || 1;
      if (d <= reach + 0.15) {
        b.combo.shift();
        startPunch(g, a, id, b.first ? a.tell : a.tell * 0.3);
        b.first = false; b.comboGap = rand(0, 0.08);
      } else if (d > 1.9) b.combo.length = 0;
    }
  }

  // 이동
  let fwd = 0;
  const want = b.combo.length ? 0.85 : b.range;
  if (b.backT > 0) fwd = -1;
  else if (d > want + 0.1) fwd = 1;
  else if (d < want - 0.12) fwd = -0.8;
  b.strafeT -= dt;
  if (b.strafeT <= 0) {
    b.strafeDir = Math.random() < 0.25 ? 0 : Math.random() < 0.5 ? -1 : 1;
    b.strafeT = rand(0.8, 2.2); b.range = rand(1.0, 1.3);
    b.wantGuard = Math.random() < D.guard * (a.stam < 30 ? 1.3 : 1);
  }
  let str = b.strafeDir * 0.55;
  if (Math.max(Math.abs(a.x), Math.abs(a.z)) > RING_HALF - 0.75) {
    // 로프에 몰리면 중앙 쪽으로 빠져나가기
    let dx = p.x - a.x, dz = p.z - a.z; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
    const rx = -dz, rz = dx;
    str = (rx * -a.x + rz * -a.z) >= 0 ? 0.9 : -0.9;
    if (fwd < 0) fwd = 0;
  }
  b.fwd = fwd; b.strafe = str;
  a.guard = (b.guardT > 0 || (b.wantGuard && !b.combo.length)) && canGuard(a);
  a.crouch = b.duckT > 0 && !a.down;
}

// ------------------------------------------------------------ 메인 업데이트
export function update(g, dt, input) {
  g.time += dt; g.stateT += dt;
  const p = g.player, a = g.ai;
  switch (g.state) {
    case 'intro':
      tickFighter(g, p, dt, false); tickFighter(g, a, dt, false);
      if (g.stateT >= 2.4) { g.state = 'fight'; g.stateT = 0; emit(g, { type: 'fight' }); }
      break;
    case 'fight':
      g.timer = Math.max(0, g.timer - dt);
      handleInput(g, dt, input);
      if (g.state !== 'fight') break;
      aiThink(g, dt);
      tickFighter(g, p, dt, true);
      tickFighter(g, a, dt, true);
      if (g.state !== 'fight') break;
      moveFighter(g, p, input.fwd || 0, input.strafe || 0, dt);
      moveFighter(g, a, a.brain.fwd, a.brain.strafe, dt);
      separate(g);
      if (g.timer <= 0) endRound(g);
      break;
    case 'count': {
      const f = g.downed, o = other(g, f);
      tickFighter(g, p, dt, false); tickFighter(g, a, dt, false);
      if (dist(f, o) < 1.8) moveFighter(g, o, -1, 0, dt); // 상대는 뉴트럴 코너 쪽으로
      const c = Math.min(10, Math.floor(g.stateT));
      if (c > g.count) { g.count = c; emit(g, { type: 'count', n: c }); }
      if (g.tko) { if (g.stateT > 2.5) finish(g, f === p ? 'ai' : 'player', 'TKO'); break; }
      if (f === p) g.mash += input.mash || 0;
      const rise = f === a ? g.count >= f.getUp : (g.mash >= g.mashNeed && g.count >= 2);
      if (rise && g.count < 10) getUp(g, f);
      else if (g.count >= 10) finish(g, f === p ? 'ai' : 'player', 'KO');
      break;
    }
    case 'break':
      tickFighter(g, p, dt, false); tickFighter(g, a, dt, false);
      if (g.stateT >= 6) {
        for (const f of [p, a]) { f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.2); f.stam = 100; }
        g.round++; g.timer = ROUND_TIME; g.state = 'intro'; g.stateT = 0;
        resetPositions(g);
        emit(g, { type: 'roundStart', round: g.round });
      }
      break;
    case 'over':
      tickFighter(g, p, dt, false); tickFighter(g, a, dt, false);
      break;
  }
  if (input) { input.presses.length = 0; input.mash = 0; }
}
