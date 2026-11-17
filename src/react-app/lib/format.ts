const clock = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const dayClock = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** id-ID writes 21.04.05; a colon reads as a clock on a dashboard and cannot be mistaken for a date. */
const colon = (text: string) => text.replace(/(\d)\.(\d)/g, "$1:$2");

export const formatClock = (ts: number) => colon(clock.format(new Date(ts)));
export const formatDayClock = (ts: number) => colon(dayClock.format(new Date(ts)));

/** Indonesian decimal comma, because every figure on this screen is read aloud. */
export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatAge(ms: number): string {
  if (ms < 0) return "baru saja";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} detik lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam ${m % 60} menit lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export function formatUptime(ms: number | null): string {
  if (ms === null) return "—";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h === 0) return `${m} menit`;
  return `${h} jam ${m % 60} menit`;
}

/** Pad a stored hour/minute pair into the value an <input type="time"> wants. */
export function toTimeValue(hour?: number, minute?: number): string {
  const h = String(hour ?? 0).padStart(2, "0");
  const m = String(minute ?? 0).padStart(2, "0");
  return `${h}:${m}`;
}

export function fromTimeValue(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export const COMMAND_LABEL: Record<string, string> = {
  feed: "Beri pakan",
  pump: "Kendali pompa",
  unlock: "Buka kunci pompa",
  settings: "Ubah setelan",
};

const shortClock = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
export const formatShortClock = (ts: number) => colon(shortClock.format(new Date(ts)));

/** Which scheduled feeding comes next, read off the device's own settings. */
export function nextFeeding(settings: Record<string, number>, now: number): { time: string; tomorrow: boolean } {
  const pagi = toTimeValue(settings.jam_pagi, settings.menit_pagi);
  const sore = toTimeValue(settings.jam_sore, settings.menit_sore);
  const d = new Date(now);
  const minutesNow = d.getHours() * 60 + d.getMinutes();
  const asMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  // "HH:MM" sorts as text, so this also holds when the evening slot is set earlier than the morning one.
  const [first, second] = [pagi, sore].sort();
  if (minutesNow < asMinutes(first)) return { time: first, tomorrow: false };
  if (minutesNow < asMinutes(second)) return { time: second, tomorrow: false };
  return { time: first, tomorrow: true };
}

export type SignalGrade = { bars: 1 | 2 | 3 | 4; label: string; tone: "ok" | "warn" | "danger" };

/** Rule-of-thumb grades for an ESP8266 on 2.4 GHz; RSSI is a rough signal, so the words stay coarse. */
export function signalGrade(rssi: number): SignalGrade {
  if (rssi >= -55) return { bars: 4, label: "Kuat", tone: "ok" };
  if (rssi >= -67) return { bars: 3, label: "Baik", tone: "ok" };
  if (rssi >= -78) return { bars: 2, label: "Lemah", tone: "warn" };
  return { bars: 1, label: "Sangat lemah", tone: "danger" };
}
