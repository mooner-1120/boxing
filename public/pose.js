// pose.js — 선수 상태 → 몸/글러브 자세 (로컬 좌표: 앞 = -z, 오른쪽 = +x, 위 = +y)
import { MOVES, EVADES } from './fight.js';

const v = (x, y, z) => ({ x, y, z });
export const GUARD = { L: v(-0.16, 1.50, -0.30), R: v(0.16, 1.48, -0.24) };
const BLOCK = { L: v(-0.085, 1.63, -0.25), R: v(0.085, 1.63, -0.25) };

const ANIM = {
  jab:    { end: v(-0.05, 1.60, -0.74), bulge: v(0, 0.03, 0),       twist: -0.15, lunge: 0.12 },
  cross:  { end: v(0.03, 1.60, -0.78),  bulge: v(0, 0.03, 0),       twist: 0.45,  lunge: 0.18 },
  lhook:  { end: v(0.10, 1.60, -0.52),  bulge: v(-0.42, 0.04, -0.05), twist: -0.6, lunge: 0.10 },
  rhook:  { end: v(-0.10, 1.60, -0.52), bulge: v(0.42, 0.04, -0.05),  twist: 0.6,  lunge: 0.10 },
  lupper: { end: v(-0.02, 1.64, -0.48), bulge: v(-0.03, -0.42, 0.05), twist: -0.3, lunge: 0.10, dip: 0.08 },
  rupper: { end: v(0.02, 1.64, -0.48),  bulge: v(0.03, -0.42, 0.05),  twist: 0.35, lunge: 0.10, dip: 0.10 },
  bjab:   { end: v(-0.05, 1.42, -0.70), bulge: v(0, 0, 0),          twist: -0.15, lunge: 0.12, dip: 0.25 },
  bcross: { end: v(0.03, 1.42, -0.74),  bulge: v(0, 0, 0),          twist: 0.45,  lunge: 0.16, dip: 0.27 },
  lbody:  { end: v(0.08, 1.42, -0.48),  bulge: v(-0.40, 0, -0.05),  twist: -0.6,  lunge: 0.08, dip: 0.27 },
  rbody:  { end: v(-0.08, 1.42, -0.48), bulge: v(0.40, 0, -0.05),   twist: 0.6,   lunge: 0.08, dip: 0.27 },
  feint:  { end: v(-0.08, 1.55, -0.50), bulge: v(0, 0, 0),          twist: -0.12, lunge: 0.08, dip: 0.04 },
};

const smooth = (u) => u * u * (3 - 2 * u);
const lerpV = (a, b, t) => v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

export function punchProgress(A) {
  const t = A.t, w = A.w || 0;
  if (t < w) return -0.18 * smooth(t / w);
  const t2 = t - w, base = w > 0 ? -0.18 : 0;
  if (t2 < A.s) return base + (1 - base) * smooth(t2 / A.s);
  if (t2 < A.s + A.a) return 1;
  const u = Math.min(1, (t2 - A.s - A.a) / A.r);
  return 1 - smooth(u);
}

export function poseOf(f, time = 0, phase = 0) {
  let dip = 0, side = 0, back = 0, roll = 0, pitch = 0, twist = 0;
  let L = f.guard ? { ...BLOCK.L } : { ...GUARD.L };
  let R = f.guard ? { ...BLOCK.R } : { ...GUARD.R };
  let windup = null;

  // 가드 상태에서 숨쉬기 / 스텝 바운스
  if (!f.crouch) dip += 0.015 * (Math.sin(time * 5.5 + phase) + 1);

  if (f.crouch) { dip += 0.3; pitch -= 0.18; }

  const e = f.evade;
  if (e) {
    const u = Math.min(1, e.t / e.dur), bell = Math.sin(Math.PI * u);
    switch (e.type) {
      case 'slipL': side -= 0.26 * bell; roll += 0.32 * bell; dip += 0.05 * bell; break;
      case 'slipR': side += 0.26 * bell; roll -= 0.32 * bell; dip += 0.05 * bell; break;
      case 'weave':
        dip += 0.36 * bell;
        side += e.dir * 0.28 * (1 - Math.cos(Math.PI * u)) * bell;
        roll -= e.dir * 0.2 * bell; pitch -= 0.15 * bell; break;
      case 'lean': back += 0.3 * bell; pitch += 0.3 * bell; break;
      case 'parry': L = lerpV(L, v(0.12, 1.58, -0.42), bell); break;
    }
  }

  const A = f.act;
  if (A) {
    const an = ANIM[A.id]; const m = MOVES[A.id];
    const p = punchProgress(A);
    const hand = m.hand;
    const guardPos = hand === 'L' ? GUARD.L : GUARD.R;
    let g = lerpV(guardPos, an.end, p);
    if (p > 0) { const s = Math.sin(Math.PI * p); g.x += an.bulge.x * s; g.y += an.bulge.y * s; g.z += an.bulge.z * s; }
    if (hand === 'L') L = g; else R = g;
    const pp = Math.max(0, p);
    twist += an.twist * p;
    back -= an.lunge * pp;
    dip += (an.dip || 0) * Math.min(1, pp * 1.5 + (A.phase === 'recovery' ? 0.3 : 0));
    pitch -= 0.06 * pp;
    if (A.phase === 'windup') windup = hand;
  }

  if (f.stun > 0) { const s = Math.min(1, f.stun * 3); L.y -= 0.14 * s; R.y -= 0.12 * s; L.z += 0.06 * s; R.z += 0.06 * s; }

  if (f.flinch > 0) {
    const k = f.flinch * f.flinch;
    if (f.flinchKind === 'hook') { roll += f.flinchSide * 0.35 * k; twist += f.flinchSide * 0.3 * k; side += f.flinchSide * 0.08 * k; }
    else if (f.flinchKind === 'upper') { pitch += 0.5 * k; }
    else { pitch += 0.3 * k; }
    back += 0.1 * k;
  }

  // 글러브는 몸 이동을 따라감
  for (const g of [L, R]) { g.x += side; g.y -= dip; g.z += back; }
  return { L, R, dip, side, back, roll, pitch, twist, windup };
}
