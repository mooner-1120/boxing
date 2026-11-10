// game.js — Three.js 렌더링, 입력, 사운드, HUD
import * as THREE from 'three';
import { makeGame, update, MOVES, RING_HALF, ROUND_TIME } from './fight.js';
import { poseOf } from './pose.js';

// ============================================================ 기본 셋업
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070b);
scene.fog = new THREE.Fog(0x07070b, 8, 24);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.03, 80);
camera.rotation.order = 'YXZ';

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();

// ============================================================ 아레나
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function buildArena() {
  const S = RING_HALF + 0.35; // 캔버스 끝
  // 바닥
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.1; floor.receiveShadow = true; scene.add(floor);

  // 링 매트
  const matTex = canvasTex(1024, 1024, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
    grd.addColorStop(0, '#2b55a8'); grd.addColorStop(1, '#183a7a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 10; g.strokeRect(40, 40, w - 80, h - 80);
    g.beginPath(); g.arc(w / 2, h / 2, 210, 0, Math.PI * 2); g.lineWidth = 14; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 120px Impact, sans-serif'; g.fillText('FPS', w / 2, h / 2 - 55);
    g.font = 'bold 100px Impact, sans-serif'; g.fillText('BOXING', w / 2, h / 2 + 60);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    // 코너 삼각형
    g.fillStyle = 'rgba(224,38,47,0.5)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(140, 0); g.lineTo(0, 140); g.fill();
    g.fillStyle = 'rgba(44,124,246,0.5)'; g.beginPath(); g.moveTo(w, h); g.lineTo(w - 140, h); g.lineTo(w, h - 140); g.fill();
  });
  const apronTex = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#5a0d12'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4c542'; g.fillRect(0, 0, w, 6);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = 'bold 54px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('FPS BOXING  ★  CHAMPIONSHIP', w / 2, h / 2 + 4);
  });
  const sideMat = new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.8 });
  const topMat = new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.85 });
  const ring = new THREE.Mesh(new THREE.BoxGeometry(S * 2 + 0.4, 1.1, S * 2 + 0.4),
    [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
  ring.position.y = -0.55; ring.receiveShadow = true; scene.add(ring);

  // 포스트 & 로프
  const postMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.8, roughness: 0.3 });
  const padColors = [0xe0262f, 0xf5f3ee, 0x2c7cf6, 0xf5f3ee];
  const corners = [[-S, -S], [S, -S], [S, S], [-S, S]];
  corners.forEach(([x, z], i) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 16), postMat);
    post.position.set(x, 0.75, z); post.castShadow = true; scene.add(post);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.2), new THREE.MeshStandardMaterial({ color: padColors[i], roughness: 0.6 }));
    pad.position.set(x * 0.985, 0.82, z * 0.985); pad.rotation.y = Math.PI / 4; pad.castShadow = true; scene.add(pad);
  });
  const ropeCols = [0x2c7cf6, 0xf5f3ee, 0xe0262f];
  [0.42, 0.82, 1.22].forEach((h, k) => {
    const mat = new THREE.MeshStandardMaterial({ color: ropeCols[k], roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = corners[i], [x2, z2] = corners[(i + 1) % 4];
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 10), mat);
      setBone(rope, _a.set(x1, h, z1), _b.set(x2, h, z2)); rope.castShadow = true; scene.add(rope);
    }
  });

  // 조명
  scene.add(new THREE.HemisphereLight(0x8899ff, 0x221111, 0.35));
  const spot = new THREE.SpotLight(0xfff4e0, 3.2, 0, Math.PI / 5, 0.45, 0);
  spot.position.set(0, 8, 0); spot.target.position.set(0, 0, 0);
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0004;
  spot.shadow.camera.near = 3; spot.shadow.camera.far = 12;
  scene.add(spot, spot.target);
  const rim1 = new THREE.PointLight(0xff3344, 0.9, 16, 0); rim1.position.set(-5, 3, -5); scene.add(rim1);
  const rim2 = new THREE.PointLight(0x3366ff, 0.9, 16, 0); rim2.position.set(5, 3, 5); scene.add(rim2);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(2, 4, 6); scene.add(fill);

  // 천장 조명 트러스
  const truss = new THREE.Group();
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 0.7, roughness: 0.4 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6dd });
  for (const s of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 0.15), trussMat); bar.position.set(0, 6, s * 3.2); truss.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 7), trussMat); bar2.position.set(s * 3.2, 6, 0); truss.add(bar2);
    for (let i = -2; i <= 2; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.25, 12), lampMat);
      l.position.set(i * 1.3, 5.85, s * 3.2); truss.add(l);
    }
  }
  scene.add(truss);

  // 관중
  const bodyGeo = new THREE.BoxGeometry(0.44, 0.8, 0.3);
  const headGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const N = 520;
  const crowdB = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), N);
  const crowdH = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0x8a6650, roughness: 1 }), N);
  const seats = [];
  const shirt = [0x332222, 0x223344, 0x444444, 0x553322, 0x223322, 0x5a1a1a, 0x1a1a3a, 0x666655];
  let n = 0;
  for (let tier = 0; tier < 6 && n < N; tier++) {
    const r = S + 2.6 + tier * 0.9; const y = -1.1 + 0.4 + tier * 0.55;
    const per = Math.floor(r * 8 * 1.6);
    for (let i = 0; i < per && n < N; i++) {
      const t = i / per; // 사각형 둘레를 따라 배치
      const side = Math.floor(t * 4), u = (t * 4 - side) * 2 - 1;
      let x, z;
      if (side === 0) { x = u * r; z = -r; } else if (side === 1) { x = r; z = u * r; } else if (side === 2) { x = -u * r; z = r; } else { x = -r; z = -u * r; }
      x += (Math.random() - 0.5) * 0.2; z += (Math.random() - 0.5) * 0.2;
      seats.push({ x, y, z, ph: Math.random() * 10, amp: 0.5 + Math.random() });
      crowdB.setColorAt(n, new THREE.Color(shirt[Math.floor(Math.random() * shirt.length)]));
      n++;
    }
  }
  crowdB.count = crowdH.count = n;
  scene.add(crowdB, crowdH);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  return {
    updateCrowd(t, excite) {
      for (let i = 0; i < n; i++) {
        const s = seats[i];
        const bob = Math.max(0, Math.sin(t * (3 + excite * 5) + s.ph)) * (0.03 + excite * 0.18) * s.amp;
        q.setFromAxisAngle(Y, Math.atan2(-s.x, -s.z));
        m4.compose(_a.set(s.x, s.y + bob, s.z), q, _b.set(1, 1, 1)); crowdB.setMatrixAt(i, m4);
        m4.compose(_a.set(s.x, s.y + 0.55 + bob, s.z), q, _b.set(1, 1, 1)); crowdH.setMatrixAt(i, m4);
      }
      crowdB.instanceMatrix.needsUpdate = true; crowdH.instanceMatrix.needsUpdate = true;
    },
  };
}

// ============================================================ 선수 모델
function setBone(mesh, a, b) {
  _c.subVectors(b, a); const len = _c.length() || 0.0001;
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y, _c.divideScalar(len));
  mesh.scale.set(1, len, 1);
}

// 2본 IK: 어깨 S → 글러브 T, 팔꿈치 E 계산 (결과 G는 실제 도달 위치)
function ik(S, T, la, lb, pole, outE, outG) {
  _a.subVectors(T, S); const len = _a.length() || 0.0001; _a.divideScalar(len);
  const L = Math.min(Math.max(len, Math.abs(la - lb) + 0.02), (la + lb) * 0.999);
  outG.copy(S).addScaledVector(_a, L);
  const cosA = (la * la + L * L - lb * lb) / (2 * la * L);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _b.subVectors(pole, S); _b.addScaledVector(_a, -_b.dot(_a));
  if (_b.lengthSq() < 1e-6) _b.set(0, -1, 0); _b.normalize();
  outE.copy(S).addScaledVector(_a, la * cosA).addScaledVector(_b, la * sinA);
}

function std(color, rough = 0.6, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }); }
function mesh(geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; }

function makeGlove(color) {
  const g = new THREE.Group();
  const mat = std(color, 0.35, { emissive: new THREE.Color(color), emissiveIntensity: 0 });
  const main = mesh(new THREE.SphereGeometry(1, 20, 16), mat); main.scale.set(0.085, 0.09, 0.115); main.position.z = 0.03; g.add(main);
  const thumb = mesh(new THREE.SphereGeometry(1, 12, 10), mat); thumb.scale.set(0.035, 0.035, 0.06); thumb.position.set(0, 0.06, 0.03); g.add(thumb);
  const cuff = mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.09, 16), std(0xf3f0e8, 0.5)); cuff.rotation.x = Math.PI / 2; cuff.position.z = -0.08; g.add(cuff);
  g.userData.mat = mat;
  return g;
}

function buildBoxer({ skin, glove, trunks, trim, hair, firstPerson = false }) {
  const root = new THREE.Group();
  const upper = new THREE.Group(); upper.rotation.order = 'YXZ'; root.add(upper);
  const hips = new THREE.Group(); root.add(hips);
  const skinM = std(skin, 0.55);
  const B = { root, upper, hips, arms: {}, legs: {}, shoulders: {}, firstPerson };

  // 어깨 기준점 (상체 로컬)
  for (const s of ['L', 'R']) {
    const o = new THREE.Object3D(); o.position.set(s === 'L' ? -0.21 : 0.21, 0.44, 0.0); upper.add(o); B.shoulders[s] = o;
  }

  if (!firstPerson) {
    const chest = mesh(new THREE.SphereGeometry(1, 24, 18), skinM); chest.scale.set(0.21, 0.24, 0.13); chest.position.y = 0.32; upper.add(chest);
    const abs = mesh(new THREE.SphereGeometry(1, 20, 14), skinM); abs.scale.set(0.17, 0.2, 0.115); abs.position.y = 0.1; upper.add(abs);
    for (const s of [-1, 1]) {
      const delt = mesh(new THREE.SphereGeometry(0.075, 16, 12), skinM); delt.position.set(s * 0.2, 0.43, 0); upper.add(delt);
      const pec = mesh(new THREE.SphereGeometry(1, 16, 12), skinM); pec.scale.set(0.09, 0.07, 0.05); pec.position.set(s * 0.085, 0.36, -0.1); upper.add(pec);
    }
    const neck = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 14), skinM); neck.position.y = 0.55; upper.add(neck);

    const head = new THREE.Group(); head.position.y = 0.66; upper.add(head); B.head = head;
    const skull = mesh(new THREE.SphereGeometry(0.12, 24, 18), skinM); skull.scale.set(1, 1.12, 1.05); head.add(skull);
    const hairM = std(hair, 0.9);
    const cap = mesh(new THREE.SphereGeometry(0.124, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), hairM); cap.scale.set(1, 1.12, 1.06); cap.position.y = 0.01; cap.rotation.x = 0.25; head.add(cap);
    const eyeW = std(0xffffff, 0.3), eyeB = std(0x111111, 0.2);
    for (const s of [-1, 1]) {
      const e = mesh(new THREE.SphereGeometry(0.018, 10, 8), eyeW, false); e.position.set(s * 0.042, 0.02, -0.112); head.add(e);
      const p = mesh(new THREE.SphereGeometry(0.009, 8, 6), eyeB, false); p.position.set(s * 0.042, 0.02, -0.127); head.add(p);
      const brow = mesh(new THREE.BoxGeometry(0.045, 0.01, 0.015), hairM, false); brow.position.set(s * 0.045, 0.048, -0.118); brow.rotation.z = s * -0.15; head.add(brow);
      const ear = mesh(new THREE.SphereGeometry(1, 10, 8), skinM); ear.scale.set(0.015, 0.03, 0.022); ear.position.set(s * 0.12, 0.0, 0); head.add(ear);
    }
    const nose = mesh(new THREE.ConeGeometry(0.018, 0.045, 8), skinM); nose.rotation.x = -Math.PI / 2 - 0.3; nose.position.set(0, -0.005, -0.13); head.add(nose);
    const mouth = mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), std(0x3a1010, 0.6), false); mouth.position.set(0, -0.055, -0.117); head.add(mouth);

    // 트렁크 & 다리
    const trunksM = std(trunks, 0.7), trimM = std(trim, 0.4, { metalness: 0.3 });
    const tr = mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.28, 20), trunksM); tr.position.y = -0.08; hips.add(tr);
    const band = mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.06, 20), trimM); band.position.y = 0.06; hips.add(band);
    const shoeM = std(0x111111, 0.5), sockM = std(0xf0f0f0, 0.8);
    for (const s of ['L', 'R']) {
      const thigh = mesh(new THREE.CylinderGeometry(0.085, 0.07, 1, 14), trunksM);
      const shin = mesh(new THREE.CylinderGeometry(0.065, 0.048, 1, 12), skinM);
      const knee = mesh(new THREE.SphereGeometry(0.068, 12, 10), skinM);
      const foot = mesh(new THREE.BoxGeometry(0.1, 0.09, 0.24), shoeM);
      const sock = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12), sockM);
      root.add(thigh, shin, knee, foot, sock);
      B.legs[s] = { thigh, shin, knee, foot, sock };
    }
  }

  // 팔 (루트 기준)
  for (const s of ['L', 'R']) {
    const up = mesh(new THREE.CylinderGeometry(0.065, 0.055, 1, 14), skinM);
    const fore = mesh(new THREE.CylinderGeometry(0.055, 0.045, 1, 14), skinM);
    const elbow = mesh(new THREE.SphereGeometry(0.055, 12, 10), skinM);
    const gl = makeGlove(glove);
    root.add(up, fore, elbow, gl);
    if (firstPerson) { up.visible = false; }
    B.arms[s] = { up, fore, elbow, glove: gl };
  }
  scene.add(root);
  return B;
}

// 화면에 보이는 자세(부드럽게 보간)
function makeDisplayPose() {
  return { L: new THREE.Vector3(-0.16, 1.5, -0.3), R: new THREE.Vector3(0.16, 1.48, -0.24), dip: 0, side: 0, back: 0, roll: 0, pitch: 0, twist: 0 };
}
function smoothPose(dp, tp, dt, k = 30) {
  const a = 1 - Math.exp(-k * dt);
  dp.L.lerp(_a.set(tp.L.x, tp.L.y, tp.L.z), a);
  dp.R.lerp(_a.set(tp.R.x, tp.R.y, tp.R.z), a);
  for (const key of ['dip', 'side', 'back', 'roll', 'pitch', 'twist']) dp[key] += (tp[key] - dp[key]) * a;
}

const ARM_UP = 0.36, ARM_FORE = 0.34, THIGH = 0.5, SHIN = 0.5;
const tmpS = new THREE.Vector3(), tmpE = new THREE.Vector3(), tmpG = new THREE.Vector3(), tmpP = new THREE.Vector3();

function applyPose(B, f, opp, dp, windup, downT) {
  const root = B.root;
  root.position.set(f.x, 0, f.z);
  root.rotation.set(0, Math.atan2(-(opp.x - f.x), -(opp.z - f.z)), 0, 'YXZ');
  if (!B.firstPerson) {
    root.rotation.x = downT * 1.45;
    root.position.y = downT * 0.05;
  }
  B.upper.position.set(dp.side, 1.0 - dp.dip, dp.back);
  B.upper.rotation.set(dp.pitch, dp.twist, dp.roll);
  B.hips.position.set(dp.side * 0.4, 1.0 - dp.dip * 0.9, dp.back * 0.5);
  B.hips.rotation.y = dp.twist * 0.3;
  B.upper.updateMatrix(); B.hips.updateMatrix();

  for (const s of ['L', 'R']) {
    const arm = B.arms[s];
    tmpS.copy(B.shoulders[s].position).applyMatrix4(B.upper.matrix);
    const target = s === 'L' ? dp.L : dp.R;
    let T = target;
    if (downT > 0.01 && !B.firstPerson) T = _d.set(s === 'L' ? -0.35 : 0.35, 0.95, 0.05).lerp(target, 1 - downT);
    tmpP.copy(tmpS).add(_c.set(s === 'L' ? -0.35 : 0.35, -0.55, 0.15));
    ik(tmpS, T, ARM_UP, ARM_FORE, tmpP, tmpE, tmpG);
    setBone(arm.up, tmpS, tmpE);
    setBone(arm.fore, tmpE, tmpG);
    arm.elbow.position.copy(tmpE);
    arm.glove.position.copy(tmpG);
    _c.subVectors(tmpG, tmpE).normalize();
    arm.glove.quaternion.setFromUnitVectors(Z, _c);
    arm.glove.userData.mat.emissiveIntensity = windup === s ? 0.9 : 0;
  }

  if (!B.firstPerson) {
    const moving = Math.hypot(f.vx, f.vz) > 0.25;
    for (const s of ['L', 'R']) {
      const leg = B.legs[s]; const sg = s === 'L' ? -1 : 1;
      const hip = _a.set(sg * 0.1, -0.12, 0).applyMatrix4(B.hips.matrix).clone();
      const lift = moving ? Math.max(0, Math.sin(f.walk * 9 + (s === 'L' ? 0 : Math.PI))) * 0.06 : 0;
      const foot = new THREE.Vector3(sg * 0.16, 0.07 + lift, s === 'L' ? -0.17 : 0.18);
      const pole = hip.clone().add(_b.set(sg * 0.05, -0.3, -0.6));
      ik(hip, foot, THIGH, SHIN, pole, tmpE, tmpG);
      setBone(leg.thigh, hip, tmpE); setBone(leg.shin, tmpE, tmpG);
      leg.knee.position.copy(tmpE);
      leg.foot.position.set(tmpG.x, 0.045 + lift, tmpG.z - 0.05);
      leg.sock.position.set(tmpG.x, 0.12 + lift, tmpG.z);
    }
  }
}

// ============================================================ 이펙트
const sparkTex = canvasTex(128, 128, (g, w, h) => {
  const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,230,150,0.9)');
  grd.addColorStop(0.6, 'rgba(255,120,40,0.35)'); grd.addColorStop(1, 'rgba(255,80,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 4;
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 18, h / 2 + Math.sin(a) * 18); g.lineTo(w / 2 + Math.cos(a) * 60, h / 2 + Math.sin(a) * 60); g.stroke(); }
});
const sparks = [];
for (let i = 0; i < 10; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.visible = false; scene.add(sp); sparks.push({ sp, t: 1, size: 0.3 });
}
function spark(pos, size, color) {
  const s = sparks.find((x) => x.t >= 1) || sparks[0];
  s.t = 0; s.size = size; s.sp.position.copy(pos); s.sp.material.color.set(color); s.sp.visible = true;
  s.sp.material.rotation = Math.random() * Math.PI;
}
function updateSparks(dt) {
  for (const s of sparks) {
    if (s.t >= 1) { s.sp.visible = false; continue; }
    s.t = Math.min(1, s.t + dt / 0.22);
    const k = s.size * (0.6 + s.t * 0.9); s.sp.scale.set(k, k, k);
    s.sp.material.opacity = 1 - s.t;
  }
}

const floaters = document.getElementById('floaters');
function floater(worldPos, text, cls = '', sub = '') {
  _a.copy(worldPos).project(camera);
  if (_a.z > 1) return;
  const el = document.createElement('div');
  el.className = 'floater ' + cls;
  el.style.left = ((_a.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 40) + 'px';
  el.style.top = ((-_a.y * 0.5 + 0.5) * window.innerHeight) + 'px';
  el.innerHTML = text + (sub ? `<span class="k">${sub}</span>` : '');
  floaters.appendChild(el);
  setTimeout(() => el.remove(), 950);
}
function floaterScreen(x, y, text, cls) {
  const el = document.createElement('div'); el.className = 'floater ' + cls;
  el.style.left = x * window.innerWidth + 'px'; el.style.top = y * window.innerHeight + 'px';
  el.textContent = text; floaters.appendChild(el); setTimeout(() => el.remove(), 950);
}

// ============================================================ 사운드 (WebAudio 합성)
const sfx = {
  ctx: null, master: null, noise: null, crowdGain: null,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.6; this.master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 600; lp.Q.value = 0.6;
    this.crowdGain = ctx.createGain(); this.crowdGain.gain.value = 0.05;
    src.connect(lp).connect(this.crowdGain).connect(this.master); src.start();
  },
  noiseBurst(dur, type, f0, f1, vol, q = 1) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },
  tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  whoosh(w = 1) { this.noiseBurst(0.14 + 0.05 * w, 'bandpass', 700, 2600, 0.12 * w, 1.2); },
  hit(power = 1) { this.tone(150, 45, 0.16, 0.8 * power); this.noiseBurst(0.07, 'lowpass', 2500, 400, 0.5 * power); },
  block() { this.tone(110, 60, 0.08, 0.35); this.noiseBurst(0.05, 'lowpass', 900, 300, 0.25); },
  parry() { this.tone(900, 500, 0.07, 0.2, 'triangle'); this.noiseBurst(0.04, 'highpass', 3000, 2000, 0.15); },
  tick() { this.tone(1200, 1100, 0.05, 0.15, 'square'); },
  bell(times = 3) {
    for (let k = 0; k < times; k++) for (const [r, v] of [[1, 0.35], [2.76, 0.15], [5.4, 0.08]]) this.tone(560 * r, 560 * r * 0.995, 1.3, v, 'sine', k * 0.32);
  },
  crowd(level) { if (this.crowdGain) this.crowdGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.4); },
  roar() { this.noiseBurst(1.8, 'bandpass', 500, 900, 0.35, 0.5); },
};

// ============================================================ 입력
const PUNCH_KEYS = { KeyJ: 'jab', KeyK: 'cross', KeyU: 'lhook', KeyI: 'rhook', KeyN: 'lupper', KeyM: 'rupper', KeyH: 'lbody', KeyL: 'rbody', KeyR: 'feint' };
const EVADE_KEYS = { KeyQ: 'slipL', KeyE: 'slipR', Space: 'weave', KeyF: 'lean', KeyX: 'parry' };
const held = new Set();
const input = { fwd: 0, strafe: 0, guard: false, crouch: false, presses: [], mash: 0 };
let weaveAlt = 1;

window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (['Space', 'Tab', 'ShiftLeft', 'ShiftRight'].includes(code) || PUNCH_KEYS[code] || EVADE_KEYS[code]) e.preventDefault();
  if (!running) return;
  if (code === 'Escape' || code === 'KeyP') { if (!e.repeat) togglePause(); return; }
  if (code === 'Tab') { if (!e.repeat) document.getElementById('help').classList.toggle('hidden'); return; }
  if (e.repeat) return;
  held.add(code);
  if (paused) return;
  if (code === 'Space') input.mash++;
  if (PUNCH_KEYS[code]) input.presses.push({ kind: 'punch', id: PUNCH_KEYS[code] });
  else if (EVADE_KEYS[code]) {
    let dir = 1;
    if (code === 'Space') { dir = held.has('KeyA') ? -1 : held.has('KeyD') ? 1 : (weaveAlt = -weaveAlt); }
    input.presses.push({ kind: 'evade', id: EVADE_KEYS[code], dir });
  }
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());

function readHeld() {
  input.fwd = (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0);
  input.strafe = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
  input.guard = held.has('ShiftLeft') || held.has('ShiftRight');
  input.crouch = held.has('KeyC');
}

// ============================================================ HUD
const $ = (id) => document.getElementById(id);
const hud = $('hud'), msgEl = $('msg'), subEl = $('sub'), comboEl = $('combo');
let msgTimer = 0, subTimer = 0;
function showMsg(text, dur = 1.2, sub = '') {
  msgEl.textContent = text; msgEl.classList.remove('show'); void msgEl.offsetWidth; msgEl.classList.add('show'); msgTimer = dur;
  if (sub) { subEl.textContent = sub; subEl.classList.add('show'); subTimer = dur; }
}
function fmtTime(t) { const s = Math.ceil(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
const lag = { p: 100, a: 100 };
function updateHud(dt) {
  const p = game.player, a = game.ai;
  const ph = p.hp / p.maxHp * 100, ah = a.hp / a.maxHp * 100;
  $('pHp').style.width = ph + '%'; $('aHp').style.width = ah + '%';
  $('pHpLag').style.width = ph + '%'; $('aHpLag').style.width = ah + '%';
  $('pSt').style.width = p.stam + '%'; $('aSt').style.width = a.stam + '%';
  $('pSt').parentElement.classList.toggle('low', p.stam < 25);
  $('aSt').parentElement.classList.toggle('low', a.stam < 25);
  $('pKd').textContent = '●'.repeat(p.kd); $('aKd').textContent = '●'.repeat(a.kd);
  $('round').textContent = `ROUND ${game.round}/3`;
  $('timer').textContent = fmtTime(game.timer);
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) msgEl.classList.remove('show'); }
  if (subTimer > 0) { subTimer -= dt; if (subTimer <= 0) subEl.classList.remove('show'); }
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) { comboEl.classList.remove('show'); combo = 0; } }
  const mash = $('mash');
  if (game.state === 'count' && game.downed === p && !game.tko) {
    mash.classList.remove('hidden'); $('mashBar').style.width = Math.min(100, game.mash / game.mashNeed * 100) + '%';
  } else mash.classList.add('hidden');
  // 체력 낮을 때 붉은 비네트
  const low = Math.max(0, 1 - ph / 35);
  $('vignette').style.opacity = (low * (0.55 + 0.25 * Math.sin(performance.now() / 180)) + hurtV).toFixed(3);
}

let combo = 0, comboT = 0;
function addCombo() {
  combo++; comboT = 1.4;
  if (combo >= 2) { comboEl.innerHTML = `${combo} HIT<small>COMBO</small>`; comboEl.classList.add('show'); }
}

// ============================================================ 게임 상태
const arena = buildArena();
const opp = buildBoxer({ skin: 0xa86b4a, glove: 0xc8161d, trunks: 0x111114, trim: 0xf4c542, hair: 0x16110d });
const me = buildBoxer({ skin: 0xd9a27c, glove: 0x1d5fd8, trunks: 0x1d5fd8, trim: 0xffffff, hair: 0x000000, firstPerson: true });
me.upper.add(camera); camera.position.set(0, 0.64, -0.02);

let game = makeGame('normal');
let difficulty = 'normal';
let running = false, paused = false;
let hitstop = 0, shake = 0, hurtV = 0, excite = 0;
const dpP = makeDisplayPose(), dpA = makeDisplayPose();
let downP = 0, downA = 0;
let lookPitch = 0;
const headW = new THREE.Vector3(), bodyW = new THREE.Vector3();

function opponentPoint(f, target) {
  const B = f === game.ai ? opp : null;
  if (B) {
    if (target === 'body') return B.upper.localToWorld(_d.set(0, 0.12, -0.14)).clone();
    return B.head.getWorldPosition(new THREE.Vector3());
  }
  return camera.getWorldPosition(new THREE.Vector3()).add(camera.getWorldDirection(_d).multiplyScalar(0.4));
}

function processEvents() {
  const p = game.player, a = game.ai;
  for (const e of game.events) {
    switch (e.type) {
      case 'roundStart':
        showMsg(`ROUND ${e.round}`, 1.6); sfx.bell(1); break;
      case 'fight':
        showMsg('FIGHT!', 0.8); sfx.crowd(0.08); break;
      case 'swing':
        sfx.whoosh(MOVES[e.id].dmg > 8 ? 1.3 : 0.9); break;
      case 'hit': {
        const big = e.dmg >= 9 || e.counter;
        if (e.def === a) {
          const pos = opponentPoint(a, e.target);
          spark(pos, e.counter ? 0.55 : big ? 0.42 : 0.3, e.counter ? 0xffd34d : 0xffffff);
          floater(pos, e.counter ? 'COUNTER!' : Math.round(e.dmg), e.counter ? 'counter' : '', MOVES[e.id].label + (e.counter ? ` ${Math.round(e.dmg)}` : ''));
          addCombo();
          excite = Math.min(1, excite + (big ? 0.35 : 0.12));
        } else {
          shake = Math.min(0.09, shake + 0.02 + e.dmg * 0.004);
          hurtV = Math.min(0.9, hurtV + 0.25 + e.dmg * 0.03);
          flash('#c00', 0.25 + e.dmg * 0.02);
          if (e.counter) floaterScreen(0.5, 0.62, '카운터 맞음!', 'bad');
          combo = 0; comboEl.classList.remove('show');
          excite = Math.min(1, excite + (big ? 0.25 : 0.08));
        }
        sfx.hit(big ? 1.2 : 0.8);
        if (big) hitstop = e.counter ? 0.12 : 0.06;
        break;
      }
      case 'block':
        sfx.block();
        if (e.def === a) { const pos = opponentPoint(a, e.target); spark(pos, 0.18, 0x9ec9ff); floater(pos, 'BLOCK', 'blocked'); }
        else { shake = Math.min(0.05, shake + 0.012); }
        break;
      case 'evade':
        if (e.def === p) floaterScreen(0.5, 0.42, e.how === 'duck' ? '덕킹!' : '회피!', 'info');
        else floater(opponentPoint(a, 'head'), 'MISS', 'blocked');
        break;
      case 'parry':
        sfx.parry();
        if (e.def === p) { floaterScreen(0.5, 0.42, '패리!', 'info'); flash('#fff', 0.25); }
        else floater(opponentPoint(a, 'head'), 'PARRIED', 'bad');
        break;
      case 'knockdown':
        sfx.roar(); sfx.crowd(0.2); excite = 1; hitstop = 0.35;
        showMsg(e.tko ? 'T.K.O.' : 'DOWN!', 1.6, e.who === p ? (e.tko ? '3번 다운 — 경기 종료' : '스페이스바를 연타해 일어나세요!') : (e.tko ? '3번 다운 — 경기 종료' : '상대가 쓰러졌습니다!'));
        break;
      case 'count':
        if (!game.tko) { showMsg(String(e.n), 0.8); sfx.tick(); }
        break;
      case 'getup':
        showMsg('FIGHT!', 0.7); sfx.crowd(0.1); break;
      case 'bell':
        sfx.bell(3); break;
      case 'roundEnd':
        showMsg('END OF ROUND', 2.4, `${game.scores.p.at(-1)} : ${game.scores.a.at(-1)}  (이번 라운드 채점)`); sfx.crowd(0.06); break;
      case 'over':
        if (e.result === 'KO' || e.result === 'TKO') { showMsg(e.result === 'KO' ? 'K.O.!' : 'T.K.O.', 2.6); sfx.roar(); }
        else showMsg('DECISION', 2.2);
        setTimeout(showResult, 2600);
        break;
    }
  }
  game.events.length = 0;
}

const flashEl = $('flash');
function flash(color, strength) {
  flashEl.style.transition = 'none'; flashEl.style.background = color; flashEl.style.opacity = Math.min(0.7, strength);
  void flashEl.offsetWidth; flashEl.style.transition = 'opacity 0.35s'; flashEl.style.opacity = 0;
}

function showResult() {
  if (!running) return;
  const g = game;
  const win = g.winner === 'player', draw = g.winner === 'draw';
  $('resTitle').innerHTML = draw ? 'DRAW' : win ? 'YOU <span>WIN</span>' : 'YOU <span>LOSE</span>';
  $('resSub').textContent = `${g.result} · ${DIFF_LABEL[difficulty]} 난이도` + (g.result === '판정' || g.result === '무승부' ? ` · ${sum(g.scores.p)} : ${sum(g.scores.a)}` : ` · ${g.round}라운드`);
  const p = g.player.stats, a = g.ai.stats;
  const acc = (s) => s.thrown ? Math.round(s.landed / s.thrown * 100) + '%' : '-';
  const rows = [
    ['', 'YOU', 'IRON KIM'],
    ['적중 / 시도', `${p.landed} / ${p.thrown}`, `${a.landed} / ${a.thrown}`],
    ['정확도', acc(p), acc(a)],
    ['준 데미지', Math.round(p.dmg), Math.round(a.dmg)],
    ['회피 성공', p.evaded, a.evaded],
    ['다운 당함', g.player.kd, g.ai.kd],
    ...g.scores.p.map((v, i) => [`R${i + 1} 채점`, v, g.scores.a[i]]),
  ];
  $('resTable').innerHTML = rows.map((r, i) => `<tr>${r.map((c) => i ? `<td>${c}</td>` : `<th>${c}</th>`).join('')}</tr>`).join('');
  $('result').classList.remove('hidden');
}
const sum = (arr) => arr.reduce((s, v) => s + v, 0);
const DIFF_LABEL = { easy: '쉬움', normal: '보통', hard: '어려움' };

// ============================================================ 메뉴
document.querySelectorAll('.diff button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.diff button').forEach((x) => x.classList.remove('sel'));
  b.classList.add('sel'); difficulty = b.dataset.diff;
}));
function startMatch() {
  sfx.init(); if (sfx.ctx && sfx.ctx.state === 'suspended') sfx.ctx.resume();
  game = makeGame(difficulty);
  running = true; paused = false; held.clear();
  combo = 0; excite = 0; hurtV = 0; downA = downP = 0;
  $('menu').classList.add('hidden'); $('result').classList.add('hidden'); $('pause').classList.add('hidden');
  hud.classList.remove('hidden');
}
function toMenu() {
  running = false; paused = false;
  $('menu').classList.remove('hidden'); $('result').classList.add('hidden'); $('pause').classList.add('hidden');
  hud.classList.add('hidden'); sfx.crowd(0.03);
}
function togglePause() {
  if (game.state === 'over') return;
  paused = !paused; held.clear();
  $('pause').classList.toggle('hidden', !paused);
}
$('startBtn').addEventListener('click', startMatch);
$('againBtn').addEventListener('click', startMatch);
$('menuBtn').addEventListener('click', toMenu);
$('resumeBtn').addEventListener('click', togglePause);
$('quitBtn').addEventListener('click', toMenu);

// ============================================================ 루프
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  const g = game, p = g.player, a = g.ai;

  if (running && !paused) {
    readHeld();
    let sdt = dt;
    if (hitstop > 0) { hitstop -= dt; sdt = dt * 0.12; }
    update(g, sdt, input);
    processEvents();
  } else if (!running) {
    // 메뉴 화면: 천천히 도는 카메라
    a.x = 0; a.z = -0.3; p.x = Math.sin(now / 4000) * 1.6; p.z = Math.cos(now / 4000) * 1.6 - 0.3;
    g.time += dt;
  }

  // 자세
  const tpP = poseOf(p, g.time, 0), tpA = poseOf(a, g.time, 1.7);
  smoothPose(dpP, tpP, dt, 32); smoothPose(dpA, tpA, dt, 28);
  downA += ((a.down || (g.state === 'over' && g.winner === 'player' && g.result !== '판정' && g.result !== '무승부') ? 1 : 0) - downA) * (1 - Math.exp(-dt * 5));
  downP += ((p.down || (g.state === 'over' && g.winner === 'ai' && g.result !== '판정' && g.result !== '무승부') ? 1 : 0) - downP) * (1 - Math.exp(-dt * 5));
  applyPose(opp, a, p, dpA, tpA.windup, downA);
  applyPose(me, p, a, dpP, null, 0);

  // 카메라: 항상 상대 머리를 바라봄
  me.root.updateMatrixWorld(true); opp.root.updateMatrixWorld(true);
  opp.head.getWorldPosition(headW);
  const camW = camera.getWorldPosition(_a);
  const horiz = Math.hypot(headW.x - camW.x, headW.z - camW.z);
  const wantPitch = Math.atan2((downA > 0.5 ? headW.y : headW.y - 0.06) - camW.y, horiz) - dpP.pitch * 0.6;
  lookPitch += (wantPitch - lookPitch) * (1 - Math.exp(-dt * 12));
  shake *= Math.exp(-dt * 9); hurtV *= Math.exp(-dt * 2.5); excite *= Math.exp(-dt * 0.35);
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  camera.rotation.set(lookPitch + sy, -dpP.twist * 0.85 + sx, 0);
  // 플레이어 다운: 바닥으로 쓰러지는 시점
  if (downP > 0.01) {
    camera.position.set(0.15 * downP, 0.64 - downP * 1.05, -0.02 + downP * 0.3);
    camera.rotation.z += downP * 0.9; camera.rotation.x += downP * 0.7;
  } else camera.position.set(0, 0.64, -0.02);
  for (const s of ['L', 'R']) me.arms[s].glove.visible = me.arms[s].fore.visible = me.arms[s].elbow.visible = downP < 0.6;

  updateSparks(dt);
  arena.updateCrowd(g.time, excite);
  if (running) updateHud(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
