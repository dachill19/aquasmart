/**
 * Telegram bridge: outbound alerts and inbound commands.
 *
 * This lives in the worker rather than in the firmware on purpose. A second TLS
 * connection does not fit on the device: BearSSL needs roughly 16-22 KB of heap
 * per connection, and the ESP8266 was already failing telemetry posts with
 * `heap 16440` logged. Putting the bridge here costs the device nothing at all,
 * needs no re-flash, and keeps working when the device is too busy to talk.
 *
 * The trade is that an offline device cannot raise an alert. That loses nothing
 * real: a device that cannot reach this worker could not reach Telegram either.
 */

export type TelegramEnv = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
};

/** Reading fields the bot reports. Kept narrow so this module owns no schema. */
type StatusRow = {
  ts: number;
  level_air: number | null;
  raw_water: number | null;
  stok_pakan: number | null;
  jarak_pakan: number | null;
  pompa: number;
  terkunci: number;
  status_air: string | null;
  status_pakan: string | null;
};

/** A device is called offline once it has been quiet for longer than this. */
const OFFLINE_AFTER_MS = 60_000;

const BANTUAN = [
  "AQUASMART - kendali akuarium",
  "",
  "/status - kondisi air, pakan, dan pompa saat ini",
  "/pakan - beri pakan sekarang",
  "/pompa - nyalakan atau matikan pompa",
  "/buka - buka kunci pompa",
  "/help - tampilkan pesan ini",
].join("\n");

export async function kirimTelegram(env: TelegramEnv, text: string): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
    });
    return r.ok;
  } catch {
    // A failed notification must never fail the request that triggered it.
    return false;
  }
}

/** Sends several alerts in order, so a burst arrives as separate messages. */
export async function kirimSemua(env: TelegramEnv, pesan: string[]): Promise<void> {
  for (const t of pesan) await kirimTelegram(env, t);
}

/** WIB wall clock. The zone is fixed at UTC+7 and has no daylight saving. */
function jamWib(ts: number): string {
  const d = new Date(ts + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}.${p(d.getUTCMinutes())}.${p(d.getUTCSeconds())} WIB`;
}

function usia(ms: number): string {
  const detik = Math.floor(ms / 1000);
  if (detik < 60) return `${detik} detik lalu`;
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  return `${jam} jam ${menit % 60} menit lalu`;
}

/**
 * Alert text for an event the firmware raised. Returns null for event kinds
 * that are routine enough that pushing them would train the owner to ignore
 * the bot.
 */
export function pesanEvent(kind: string, message: string): string | null {
  if (kind === "critical_water") return `PERINGATAN AIR\n${message}`;
  if (kind === "critical_food") return `PERINGATAN PAKAN\n${message}`;
  if (kind === "feed_done") return `Pakan diberikan.\n${message}`;
  return null;
}

async function laporanStatus(db: D1Database): Promise<string> {
  const r = await db
    .prepare(
      `SELECT ts, level_air, raw_water, stok_pakan, jarak_pakan, pompa, terkunci,
              status_air, status_pakan
         FROM readings ORDER BY ts DESC LIMIT 1`
    )
    .first<StatusRow>();

  if (!r) return "Alat belum pernah melapor, jadi belum ada data untuk ditampilkan.";

  const umur = Date.now() - r.ts;
  const baris = [
    umur > OFFLINE_AFTER_MS
      ? `ALAT TIDAK TERHUBUNG. Angka di bawah pembacaan terakhir, bukan kondisi sekarang.`
      : `Alat terhubung.`,
    "",
    r.level_air === null
      ? "Air: tidak terbaca"
      : `Air: ${r.level_air}% (${r.status_air ?? "-"}), ADC ${r.raw_water ?? "-"}`,
    r.stok_pakan === null
      ? "Pakan: tidak terbaca"
      : `Pakan: ${r.stok_pakan}% (${r.status_pakan ?? "-"}), jarak ${
          r.jarak_pakan === null ? "-" : Math.round(r.jarak_pakan * 10)
        } mm`,
    `Pompa: ${r.terkunci ? "terkunci" : r.pompa ? "menyala" : "mati"}`,
    "",
    `Pembacaan: ${jamWib(r.ts)} (${usia(umur)})`,
  ];
  return baris.join("\n");
}

/** Queues a command on the same table the dashboard writes to. */
async function antreanPerintah(
  db: D1Database,
  type: string,
  payload: Record<string, unknown>
): Promise<number> {
  const res = await db
    .prepare("INSERT INTO commands (ts, type, payload) VALUES (?,?,?)")
    .bind(Date.now(), type, JSON.stringify(payload))
    .run();
  return Number(res.meta.last_row_id);
}

async function pompaSedangNyala(db: D1Database): Promise<boolean> {
  const r = await db.prepare("SELECT pompa FROM readings ORDER BY ts DESC LIMIT 1").first<{ pompa: number }>();
  return Boolean(r?.pompa);
}

async function jawab(teks: string, db: D1Database): Promise<string> {
  const perintah = teks.trim().split(/\s+/)[0].toLowerCase().split("@")[0];

  if (perintah === "/status") return laporanStatus(db);

  if (perintah === "/pakan") {
    const id = await antreanPerintah(db, "feed", {});
    return `Perintah beri pakan diantrekan (#${id}).\nAlat menjalankannya pada laporan berikutnya.`;
  }

  if (perintah === "/pompa") {
    const nyala = !(await pompaSedangNyala(db));
    const id = await antreanPerintah(db, "pump", { on: nyala });
    return `Perintah ${nyala ? "menyalakan" : "mematikan"} pompa diantrekan (#${id}).`;
  }

  if (perintah === "/buka") {
    const id = await antreanPerintah(db, "unlock", {});
    return `Perintah buka kunci pompa diantrekan (#${id}).`;
  }

  if (perintah === "/start" || perintah === "/help") return BANTUAN;

  return `Perintah tidak dikenal.\n\n${BANTUAN}`;
}

/**
 * Telegram webhook. Two gates guard it: the secret header Telegram echoes back,
 * and an allowlist of exactly one chat. Without both, the public URL would let
 * anyone queue commands against the aquarium.
 */
export async function tanganiWebhook(req: Request, env: TelegramEnv): Promise<Response> {
  if (
    !env.TELEGRAM_WEBHOOK_SECRET ||
    req.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return new Response("unauthorized", { status: 401 });
  }

  let update: { message?: { text?: string; chat?: { id?: number | string } } };
  try {
    update = await req.json();
  } catch {
    return new Response("ok");
  }

  const pesan = update.message;
  const chatId = pesan?.chat?.id;
  // Telegram retries anything that is not 2xx, so unwanted updates are
  // acknowledged and dropped rather than rejected.
  if (!pesan?.text || String(chatId) !== String(env.TELEGRAM_CHAT_ID)) return new Response("ok");

  const balasan = await jawab(pesan.text, env.DB);
  await kirimTelegram(env, balasan);
  return new Response("ok");
}
