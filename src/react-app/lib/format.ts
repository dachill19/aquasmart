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

export const formatClock = (ts: number) => clock.format(new Date(ts));
export const formatDayClock = (ts: number) => dayClock.format(new Date(ts));

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
