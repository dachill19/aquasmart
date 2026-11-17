import { useCallback, useEffect, useRef, useState } from "react";

// The worker owns these shapes; importing them keeps both sides of the API in step.
import type { CommandRow, EventRow, Reading, Settings } from "../../worker/index";
export type { CommandRow, EventRow, Reading, Settings };

export type Latest = {
  reading: Reading | null;
  events: EventRow[];
  commands: CommandRow[];
  settings: Settings;
  server_time: number;
};

export type HistoryPoint = {
  ts: number;
  level_air: number | null;
  stok_pakan: number | null;
  pompa: number;
};

/** A device that has not reported inside this window is treated as offline. */
export const OFFLINE_AFTER_MS = 60_000;

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function sendCommand(
  type: "feed" | "pump" | "unlock" | "settings",
  payload: Record<string, unknown> = {}
): Promise<void> {
  const res = await fetch("/api/command", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, payload }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Gagal mengirim perintah (${res.status})`);
  }
}

type Poll = {
  latest: Latest | null;
  history: HistoryPoint[];
  error: string | null;
  loading: boolean;
  refresh: () => void;
};

/**
 * One timer drives both endpoints. The interval is deliberately a little faster
 * than the device's own reporting cycle so a queued command visibly clears soon
 * after the device collects it.
 */
export function useTelemetry(intervalMs = 4000): Poll {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const [l, h] = await Promise.all([
        getJSON<Latest>("/api/latest"),
        getJSON<{ readings: HistoryPoint[] }>("/api/history?limit=120"),
      ]);
      if (!alive.current) return;
      setLatest(l);
      setHistory(h.readings);
      setError(null);
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    const id = setInterval(() => void load(), intervalMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [load, intervalMs]);

  return { latest, history, error, loading, refresh: () => void load() };
}
