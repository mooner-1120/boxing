// server.js — Render Web Service: 정적 파일 + 온라인 1:1 대전 (WebSocket)
// 외부 패키지 없이 Node 기본 모듈만 사용합니다.
// 경기 계산은 서버가 하고(서버 권한), 클라이언트는 입력만 보내고 상태를 받아 그립니다.
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { makeGame, update } from './public/fight.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');
const TICK_HZ = 60;          // 서버 시뮬레이션 주기
const SEND_EVERY = 2;        // 2틱마다 상태 전송 → 30Hz

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// ============================================================ HTTP (정적 파일)
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ online: clients.size, rooms: rooms.size, queue: queue.length }));
  }
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

// ============================================================ 최소 WebSocket 구현 (RFC 6455)
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WSConn extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket; this.buf = Buffer.alloc(0); this.frags = []; this.closed = false;
    socket.setNoDelay(true);
    socket.on('data', (d) => { this.buf = Buffer.concat([this.buf, d]); this.parse(); });
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
  }
  parse() {
    while (true) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (len > 64 * 1024) return this.close(); // 비정상적으로 큰 메시지 차단
      let mask = null;
      if (masked) { if (b.length < off + 4) return; mask = b.subarray(off, off + 4); off += 4; }
      if (b.length < off + len) return;
      const payload = Buffer.from(b.subarray(off, off + len));
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = b.subarray(off + len);

      if (op === 0x8) return this.close();                 // close
      if (op === 0x9) { this.frame(0xA, payload); continue; } // ping → pong
      if (op === 0xA) continue;                            // pong
      if (op === 0x1 || op === 0x0) {                      // text / continuation
        this.frags.push(payload);
        if (fin) {
          const msg = Buffer.concat(this.frags).toString('utf8'); this.frags = [];
          this.emit('message', msg);
        }
      }
    }
  }
  frame(op, data) {
    if (this.closed) return;
    const len = data.length; let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    this.socket.write(Buffer.concat([head, data]));
  }
  send(obj) { this.frame(0x1, Buffer.from(JSON.stringify(obj))); }
  close() {
    if (this.closed) return;
    try { this.frame(0x8, Buffer.alloc(0)); } catch {}
    this.socket.end(); this.finish();
  }
  finish() { if (this.closed) return; this.closed = true; this.socket.destroy(); this.emit('close'); }
}

server.on('upgrade', (req, socket) => {
  let pathname = '';
  try { pathname = new URL(req.url, 'http://x').pathname; } catch {}
  const key = req.headers['sec-websocket-key'];
  if (pathname !== '/ws' || !key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  onConnection(new WSConn(socket));
});

// ============================================================ 로비 / 방
const clients = new Set();
const rooms = new Map();   // code → room
let queue = [];            // 빠른 매칭 대기열

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); }
  while (rooms.has(c));
  return c;
}
const cleanName = (n) => (String(n || '').replace(/[<>&"']/g, '').trim().slice(0, 12) || 'PLAYER');
const blankInput = () => ({ fwd: 0, strafe: 0, guard: false, crouch: false, presses: [], mash: 0 });

function createRoom(conn, isPrivate) {
  const room = {
    code: newCode(), isPrivate, players: [conn, null], game: null,
    inputs: [blankInput(), blankInput()], rematch: new Set(), tick: 0, events: [],
  };
  rooms.set(room.code, room);
  conn.room = room; conn.side = 0;
  return room;
}

function startMatch(room) {
  const [c1, c2] = room.players;
  room.game = makeGame('normal', { pvp: true, name1: c1.name, name2: c2.name });
  room.inputs = [blankInput(), blankInput()];
  room.rematch.clear(); room.tick = 0; room.events = [];
  room.players.forEach((c, i) => c.send({ t: 'start', side: i === 0 ? 'p1' : 'p2', names: { p1: c1.name, p2: c2.name }, code: room.code }));
  console.log(`[match] ${room.code}: ${c1.name} vs ${c2.name}`);
}

function joinRoom(conn, room) {
  room.players[1] = conn; conn.room = room; conn.side = 1;
  startMatch(room);
}

function leaveRoom(conn, reason = 'left') {
  queue = queue.filter((c) => c !== conn);
  const room = conn.room;
  if (!room) return;
  conn.room = null;
  const other = room.players.find((c) => c && c !== conn);
  rooms.delete(room.code);
  if (other) { other.room = null; other.send({ t: 'oppLeft', reason }); }
}

function onConnection(conn) {
  clients.add(conn);
  conn.name = 'PLAYER'; conn.room = null; conn.side = 0;
  conn.on('close', () => { clients.delete(conn); leaveRoom(conn, 'disconnect'); });
  conn.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'ping': conn.send({ t: 'pong', ts: m.ts }); break;
      case 'quick': {
        leaveRoom(conn); conn.name = cleanName(m.name);
        queue = queue.filter((c) => !c.closed && c !== conn);
        const opp = queue.shift();
        if (opp) { const room = createRoom(opp, false); joinRoom(conn, room); }
        else { queue.push(conn); conn.send({ t: 'waiting', mode: 'quick' }); }
        break;
      }
      case 'create': {
        leaveRoom(conn); conn.name = cleanName(m.name);
        const room = createRoom(conn, true);
        conn.send({ t: 'waiting', mode: 'room', code: room.code });
        break;
      }
      case 'join': {
        const code = String(m.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room || !room.isPrivate) { conn.send({ t: 'error', msg: '방을 찾을 수 없어요. 코드를 확인하세요.' }); break; }
        if (room.players[1]) { conn.send({ t: 'error', msg: '이미 꽉 찬 방이에요.' }); break; }
        if (room.players[0] === conn) break;
        leaveRoom(conn); conn.name = cleanName(m.name);
        joinRoom(conn, room);
        break;
      }
      case 'leave': leaveRoom(conn); break;
      case 'in': {
        const room = conn.room; if (!room || !room.game) break;
        const inp = room.inputs[conn.side];
        const ax = (v) => (typeof v === 'number' && isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
        inp.fwd = ax(m.fwd); inp.strafe = ax(m.strafe); inp.guard = !!m.guard; inp.crouch = !!m.crouch;
        if (Array.isArray(m.presses)) for (const p of m.presses.slice(0, 6)) {
          if (p && (p.kind === 'punch' || p.kind === 'evade') && typeof p.id === 'string') inp.presses.push({ kind: p.kind, id: p.id, dir: p.dir === -1 ? -1 : 1 });
        }
        if (inp.presses.length > 12) inp.presses.splice(0, inp.presses.length - 12);
        inp.mash += Math.max(0, Math.min(10, m.mash | 0));
        break;
      }
      case 'rematch': {
        const room = conn.room; if (!room || !room.game || room.game.state !== 'over') break;
        room.rematch.add(conn.side);
        if (room.rematch.size === 2) startMatch(room);
        else room.players.forEach((c) => c && c.send({ t: 'rematchWait', from: conn.side === 0 ? 'p1' : 'p2' }));
        break;
      }
    }
  });
  conn.send({ t: 'hello' });
}

// ============================================================ 상태 직렬화
const r2 = (v) => Math.round(v * 1000) / 1000;
function serFighter(f) {
  return {
    name: f.name, x: r2(f.x), z: r2(f.z), vx: r2(f.vx), vz: r2(f.vz),
    hp: r2(f.hp), maxHp: f.maxHp, stam: r2(f.stam), guard: f.guard, crouch: f.crouch,
    act: f.act && { id: f.act.id, t: r2(f.act.t), w: f.act.w, s: r2(f.act.s), a: f.act.a, r: r2(f.act.r), phase: f.act.phase },
    evade: f.evade && { type: f.evade.type, t: r2(f.evade.t), dur: f.evade.dur, dir: f.evade.dir },
    stun: r2(f.stun), flinch: r2(f.flinch), flinchKind: f.flinchKind, flinchSide: f.flinchSide,
    down: f.down, kd: f.kd, walk: r2(f.walk), stats: f.stats,
  };
}
const sideOf = (g, f) => (f === g.player ? 'p1' : f === g.ai ? 'p2' : null);
function serEvent(g, e) {
  const o = { ...e };
  for (const k of ['who', 'att', 'def']) if (o[k]) o[k] = sideOf(g, o[k]);
  if (o.winner) o.winner = o.winner === 'player' ? 'p1' : o.winner === 'ai' ? 'p2' : o.winner;
  return o;
}
function serGame(g) {
  return {
    p1: serFighter(g.player), p2: serFighter(g.ai),
    state: g.state, stateT: r2(g.stateT), round: g.round, timer: r2(g.timer), count: g.count,
    mash: g.mash, mashNeed: g.mashNeed, tko: g.tko, downed: g.downed ? sideOf(g, g.downed) : null,
    scores: g.scores, time: r2(g.time),
    winner: g.winner === 'player' ? 'p1' : g.winner === 'ai' ? 'p2' : g.winner, result: g.result,
  };
}

// ============================================================ 게임 루프
let lastTick = process.hrtime.bigint();
setInterval(() => {
  const now = process.hrtime.bigint();
  const dt = Math.min(0.05, Number(now - lastTick) / 1e9); lastTick = now;
  for (const room of rooms.values()) {
    const g = room.game; if (!g) continue;
    update(g, dt, room.inputs[0], room.inputs[1]);
    for (const e of g.events) room.events.push(serEvent(g, e));
    g.events.length = 0;
    if (++room.tick % SEND_EVERY === 0) {
      const msg = { t: 's', st: serGame(g), ev: room.events };
      room.events = [];
      for (const c of room.players) if (c) c.send(msg);
    }
  }
}, 1000 / TICK_HZ);

server.listen(PORT, '0.0.0.0', () => console.log(`FPS BOXING server running on port ${PORT}`));
