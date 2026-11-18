/**
 * Fleet analytics: every aquarium over one time window, computed in the
 * database so the dashboard never derives a figure on its own.
 */

/** Window lengths the analytics page offers. Readings are kept 7 days, so 7d is the longest honest range. */
export const RANGES = { "1h": 3600_000, "24h": 24 * 3600_000, "7d": 7 * 24 * 3600_000 } as const;
export type Range = keyof typeof RANGES;

/** The firmware and the simulator both report every 5 s; availability is measured against it. */
const REPORT_INTERVAL_MS = 5000;
/** Points per line on the fleet charts, whatever the range. */
const SERIES_POINTS = 60;

export type DeviceAnalytics = {
  id: number;
  name: string;
  simulated: number;
  last_ts: number | null;
  last_level: number | null;
  last_stock: number | null;
  readings: number;
  /** Share of the window the device was reporting, 0..1. */
  availability: number;
  avg_level: number | null;
  min_level: number | null;
  avg_stock: number | null;
  avg_rssi: number | null;
  pump_starts: number;
  feeds: number;
  alerts: { critical_water: number; critical_food: number };
  commands: { total: number; acked: number; expired: number; pending: number };
  /** Mean time from a command being queued to the device confirming it ran. */
  avg_response_ms: number | null;
};

export type SeriesPoint = { device_id: number; ts: number; level_air: number | null; stok_pakan: number | null };

export type Analytics = {
  range: Range;
  since: number;
  until: number;
  bucket_ms: number;
  devices: DeviceAnalytics[];
  series: SeriesPoint[];
};

const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

export async function fleetAnalytics(db: D1Database, range: Range, now: number, commandTtlMs: number): Promise<Analytics> {
  const windowMs = RANGES[range];
  const since = now - windowMs;
  const bucketMs = windowMs / SERIES_POINTS;

  const [devices, readingStats, pumpStarts, eventCounts, commandStats, series] = await Promise.all([
    db
      .prepare(
        `SELECT d.id, d.name, d.simulated, r.ts AS last_ts, r.level_air AS last_level, r.stok_pakan AS last_stock
           FROM devices d
           LEFT JOIN readings r
             ON r.id = (SELECT id FROM readings WHERE device_id = d.id ORDER BY ts DESC LIMIT 1)
          ORDER BY d.id`
      )
      .all<{ id: number; name: string; simulated: number; last_ts: number | null; last_level: number | null; last_stock: number | null }>(),
    db
      .prepare(
        `SELECT device_id, COUNT(*) AS n, AVG(level_air) AS avg_level, MIN(level_air) AS min_level,
                AVG(stok_pakan) AS avg_stock, AVG(rssi) AS avg_rssi
           FROM readings WHERE ts >= ? GROUP BY device_id`
      )
      .bind(since)
      .all<{ device_id: number; n: number; avg_level: number | null; min_level: number | null; avg_stock: number | null; avg_rssi: number | null }>(),
    // A start is a reading with the pump on whose previous reading had it off.
    db
      .prepare(
        `SELECT device_id, SUM(CASE WHEN pompa = 1 AND COALESCE(prev, 0) = 0 THEN 1 ELSE 0 END) AS starts
           FROM (SELECT device_id, pompa, LAG(pompa) OVER (PARTITION BY device_id ORDER BY ts) AS prev
                   FROM readings WHERE ts >= ?)
          GROUP BY device_id`
      )
      .bind(since)
      .all<{ device_id: number; starts: number }>(),
    db
      .prepare("SELECT device_id, kind, COUNT(*) AS n FROM events WHERE ts >= ? GROUP BY device_id, kind")
      .bind(since)
      .all<{ device_id: number; kind: string; n: number }>(),
    db
      .prepare(
        `SELECT device_id, COUNT(*) AS total,
                SUM(acked_at IS NOT NULL) AS acked,
                SUM(acked_at IS NULL AND ts < ?) AS expired,
                SUM(acked_at IS NULL AND ts >= ?) AS pending,
                AVG(CASE WHEN acked_at IS NOT NULL THEN acked_at - ts END) AS avg_response
           FROM commands WHERE ts >= ? GROUP BY device_id`
      )
      .bind(now - commandTtlMs, now - commandTtlMs, since)
      .all<{ device_id: number; total: number; acked: number; expired: number; pending: number; avg_response: number | null }>(),
    db
      .prepare(
        `SELECT device_id, CAST(ts / ? AS INTEGER) * ? AS ts,
                AVG(level_air) AS level_air, AVG(stok_pakan) AS stok_pakan
           FROM readings WHERE ts >= ?
          GROUP BY device_id, CAST(ts / ? AS INTEGER)
          ORDER BY ts, device_id`
      )
      .bind(bucketMs, bucketMs, since, bucketMs)
      .all<SeriesPoint>(),
  ]);

  const byDevice = <T extends { device_id: number }>(rows: T[]) => new Map(rows.map((r) => [r.device_id, r]));
  const stats = byDevice(readingStats.results);
  const starts = byDevice(pumpStarts.results);
  const cmds = byDevice(commandStats.results);
  const eventsOf = (id: number, kind: string) =>
    eventCounts.results.find((e) => e.device_id === id && e.kind === kind)?.n ?? 0;

  return {
    range,
    since,
    until: now,
    bucket_ms: bucketMs,
    devices: devices.results.map((d) => {
      const s = stats.get(d.id);
      const c = cmds.get(d.id);
      const readings = s?.n ?? 0;
      return {
        ...d,
        readings,
        availability: Math.min(1, (readings * REPORT_INTERVAL_MS) / windowMs),
        avg_level: round1(s?.avg_level ?? null),
        min_level: s?.min_level ?? null,
        avg_stock: round1(s?.avg_stock ?? null),
        avg_rssi: s?.avg_rssi == null ? null : Math.round(s.avg_rssi),
        pump_starts: starts.get(d.id)?.starts ?? 0,
        feeds: eventsOf(d.id, "feed_done"),
        alerts: { critical_water: eventsOf(d.id, "critical_water"), critical_food: eventsOf(d.id, "critical_food") },
        commands: {
          total: c?.total ?? 0,
          acked: c?.acked ?? 0,
          expired: c?.expired ?? 0,
          pending: c?.pending ?? 0,
        },
        avg_response_ms: c?.avg_response == null ? null : Math.round(c.avg_response),
      };
    }),
    series: series.results.map((p) => ({
      device_id: p.device_id,
      ts: p.ts,
      level_air: round1(p.level_air),
      stok_pakan: round1(p.stok_pakan),
    })),
  };
}
