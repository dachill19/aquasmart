// AQUASMART device simulator.
//
// Plays extra aquariums for the scalability demo. Each simulated device talks
// to the server exactly like the ESP8266 firmware: it POSTs the same telemetry
// JSON to /api/telemetry every 5 seconds with its own x-device-key, applies the
// settings in the reply, runs the commands in the reply and acks them on the
// next post. The server cannot tell it from the real device except by the
// "simulated" flag on its row in the devices table.
//
// Usage:  npm run simulate
// Config: simulator/devices.json (gitignored; see devices.example.json).
// SIM_SERVER=http://localhost:5173 npm run simulate  targets the local dev server.

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const INTERVAL_MS = 5000;
const DRAIN_PER_TICK = 0.6; // % lost per 5 s, so the pump has work within a minute or two
const FILL_PER_TICK = 5; // % gained per 5 s while the pump runs
const FEED_STOCK_DROP = 4; // % of the hopper one feeding uses
const CONFIRM_TICKS = 3; // same confirmation the firmware demands before pumping
const FEED_HYSTERESIS = 8;
const MAX_QUEUE = 5; // the server keeps at most 5 events per post, like the firmware

// The same defaults the firmware boots with, until the first reply overrides them.
const DEFAULT_SETTINGS = {
  batas_air: 30,
  target_air: 80,
  batas_pakan: 30,
  durasi_pakan: 3,
  durasi_pompa: 5,
  air_kering: 10,
  air_basah: 210,
  pakan_penuh_mm: 35,
  pakan_kosong_mm: 82,
};

export function createDevice({ level, stock }) {
  return {
    level,
    stock,
    settings: { ...DEFAULT_SETTINGS },
    pump: false,
    pumpManual: false,
    pumpSince: 0,
    locked: false,
    lowTicks: 0,
    feeding: false,
    feedUntil: 0,
    feedMethod: "",
    feedAlertSent: false,
    // Random per run, like the firmware's boot marker, so event ids from two
    // simulated devices (or two runs) never collide.
    marker: randomBytes(4).toString("hex"),
    counter: 0,
    bootAt: Date.now(),
    events: [],
    acks: [],
  };
}

function raiseEvent(state, kind, message) {
  if (state.events.length >= MAX_QUEUE) return;
  state.events.push({ id: `${state.marker}-${++state.counter}`, kind, message });
}

function setPump(state, on, manual, now) {
  state.pump = on;
  state.pumpManual = on && manual;
  if (on) state.pumpSince = now;
}

/** One 5-second step of the aquarium and of the firmware's automation. */
export function tick(state, now) {
  const s = state.settings;

  if (state.feeding && now >= state.feedUntil) {
    state.feeding = false;
    state.stock = Math.max(0, state.stock - FEED_STOCK_DROP);
    raiseEvent(state, "feed_done", `Ikan telah diberi pakan (${state.feedMethod})`);
  }

  if (state.pump) {
    state.level = Math.min(100, state.level + FILL_PER_TICK);
    const timedOut = now - state.pumpSince >= s.durasi_pompa * 1000;
    if (!state.pumpManual && state.level >= s.target_air) {
      setPump(state, false, false, now);
    } else if (timedOut) {
      const wasManual = state.pumpManual;
      setPump(state, false, false, now);
      if (!wasManual && state.level < s.batas_air) {
        state.locked = true;
        raiseEvent(
          state,
          "critical_water",
          `Air masih ${Math.round(state.level)}% setelah pompa menyala ${s.durasi_pompa} detik. Pompa dikunci.`
        );
      }
    }
  } else {
    state.level = Math.max(0, state.level - DRAIN_PER_TICK);
    if (state.level >= s.batas_air) {
      state.lowTicks = 0;
      state.locked = false;
    } else if (!state.locked && ++state.lowTicks >= CONFIRM_TICKS) {
      state.lowTicks = 0;
      setPump(state, true, false, now);
    }
  }

  if (state.stock < s.batas_pakan) {
    if (!state.feedAlertSent) {
      raiseEvent(state, "critical_food", `Peringatan: stok pakan ikan kurang dari ${s.batas_pakan}%.`);
      state.feedAlertSent = true;
    }
  } else if (state.stock >= s.batas_pakan + FEED_HYSTERESIS) {
    state.feedAlertSent = false;
  }
}

/** The JSON the firmware posts, computed from the simulated state. */
export function buildTelemetry(state, now) {
  const s = state.settings;
  const level = Math.round(state.level);
  const stock = Math.round(state.stock);
  const distanceMm = s.pakan_kosong_mm - (stock / 100) * (s.pakan_kosong_mm - s.pakan_penuh_mm);
  const body = {
    level_air: level,
    raw_water: Math.round(s.air_kering + (level / 100) * (s.air_basah - s.air_kering)),
    stok_pakan: stock,
    jarak_pakan: Math.round(distanceMm) / 10, // firmware reports centimetres
    pompa: state.pump ? 1 : 0,
    terkunci: state.locked ? 1 : 0,
    status_air: level < s.batas_air ? "Kritis" : "Aman",
    status_pakan: stock < s.batas_pakan ? "Kritis" : "Aman",
    rssi: -52 - Math.floor(Math.random() * 17),
    uptime_ms: Math.max(0, now - state.bootAt),
  };
  if (state.events.length) body.events = state.events.map((e) => ({ ...e }));
  if (state.acks.length) body.ack = [...state.acks];
  return body;
}

/** Applies a server reply: settings first, then every command, each acked next post. */
export function applyResponse(state, resp, now) {
  for (const [k, v] of Object.entries(resp.settings ?? {})) {
    if (typeof v === "number" && Number.isFinite(v)) state.settings[k] = v;
  }
  for (const cmd of resp.commands ?? []) {
    if (cmd.type === "feed" && !state.feeding) {
      state.feeding = true;
      state.feedUntil = now + state.settings.durasi_pakan * 1000;
      state.feedMethod = "Manual dashboard";
    } else if (cmd.type === "pump") {
      if (cmd.payload?.on) {
        state.locked = false;
        setPump(state, true, true, now);
      } else {
        setPump(state, false, false, now);
      }
    } else if (cmd.type === "unlock") {
      state.locked = false;
      state.lowTicks = 0;
    }
    if (Number.isInteger(cmd.id) && !state.acks.includes(cmd.id)) state.acks.push(cmd.id);
  }
}

/**
 * One cycle for one device: step the tank, post, apply the reply. A failed or
 * rejected post is logged and leaves events and acks queued for the next
 * cycle; it never throws, so one bad device cannot stop the others.
 */
export async function postOnce(device, state, fetchImpl = fetch, log = console.log) {
  const now = Date.now();
  tick(state, now);
  const body = buildTelemetry(state, now);
  const sentEvents = state.events.length;
  const sentAcks = state.acks.length;
  try {
    const res = await fetchImpl(`${device.server}/api/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-key": device.key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      log(`[${device.name}] server menolak (${res.status}): ${(await res.text()).slice(0, 120)}`);
      return;
    }
    const reply = await res.json();
    state.events.splice(0, sentEvents);
    state.acks.splice(0, sentAcks);
    for (const cmd of reply.commands ?? []) log(`[${device.name}] perintah diterima: ${cmd.type}`);
    applyResponse(state, reply, now);
  } catch (err) {
    log(`[${device.name}] gagal menghubungi server: ${err instanceof Error ? err.message : err}`);
  }
}

function summary(name, state) {
  const pump = state.locked ? "terkunci" : state.pump ? "menyala" : "mati";
  return `[${name}] air ${Math.round(state.level)}% · pakan ${Math.round(state.stock)}% · pompa ${pump}`;
}

export function run(config) {
  const server = process.env.SIM_SERVER ?? config.server;
  console.log(`Simulator AQUASMART -> ${server} (Ctrl+C untuk berhenti)`);
  for (const d of config.devices) {
    const device = { server, key: d.key, name: d.name };
    const state = createDevice({ level: d.level ?? 60, stock: d.stock ?? 70 });
    let busy = false;
    let cycles = 0;
    const cycle = async () => {
      if (busy) return; // a slow reply never stacks a second post on top
      busy = true;
      await postOnce(device, state);
      if (cycles++ % 6 === 0) console.log(summary(device.name, state));
      busy = false;
    };
    void cycle();
    setInterval(cycle, INTERVAL_MS);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = new URL("./devices.json", import.meta.url);
  let config;
  try {
    config = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`Tidak bisa membaca ${file.pathname}: ${err.message}`);
    console.error("Salin simulator/devices.example.json ke simulator/devices.json lalu isi kuncinya.");
    process.exit(1);
  }
  run(config);
}
