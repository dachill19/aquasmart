import { useCallback, useEffect, useRef, useState } from "react";

// The worker owns these shapes; importing them keeps both sides of the API in step.
import type { Analytics, CommandRow, DeviceSummary, EventRow, Reading, Settings } from "../../worker/index";
export type { Analytics, CommandRow, DeviceSummary, EventRow, Reading, Settings };
export type { DeviceAnalytics } from "../../worker/index";

export type AnalyticsRange = "1h" | "24h" | "7d";

export type Latest = {
  device: number;
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
  device: number,
  type: "feed" | "pump" | "unlock" | "settings",
  payload: Record<string, unknown> = {}
): Promise<void> {
  const res = await fetch("/api/command", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device, type, payload }),
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
 * One timer drives both endpoints for the selected aquarium. The interval is
 * deliberately a little faster than the device's own reporting cycle so a
 * queued command visibly clears soon after the device collects it.
 *
 * Switching aquarium clears the previous one's numbers at once, and a reply
 * that arrives for an aquarium no longer selected is dropped, so the screen
 * never shows one tank's water under another tank's name.
 */
export function useTelemetry(device: number, intervalMs = 4000): Poll {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const current = useRef(device);

  const load = useCallback(async () => {
    try {
      const [l, h] = await Promise.all([
        getJSON<Latest>(`/api/latest?device=${device}`),
        getJSON<{ readings: HistoryPoint[] }>(`/api/history?device=${device}&limit=120`),
      ]);
      if (current.current !== device) return;
      setLatest(l);
      setHistory(h.readings);
      setError(null);
    } catch (err) {
      if (current.current !== device) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (current.current === device) setLoading(false);
    }
  }, [device]);

  useEffect(() => {
    current.current = device;
    setLatest(null);
    setHistory([]);
    setError(null);
    setLoading(true);
    void load();
    const id = setInterval(() => void load(), intervalMs);
    return () => {
      // Any reply still in flight belongs to a view that is gone.
      current.current = -1;
      clearInterval(id);
    };
  }, [device, load, intervalMs]);

  return { latest, history, error, loading, refresh: () => void load() };
}

/** Every aquarium with its newest reading, for the fleet strip. */
export function useDevices(intervalMs = 4000): { devices: DeviceSummary[]; loaded: boolean; error: string | null } {
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const body = await getJSON<{ devices: DeviceSummary[] }>("/api/devices");
        if (!alive) return;
        setDevices(body.devices);
        setError(null);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (alive) setLoaded(true);
      }
    };
    void load();
    const id = setInterval(() => void load(), intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { devices, loaded, error };
}

/**
 * Fleet analytics for one range, refreshed every 5 s so the Analitik page moves
 * during the demo. Changing range clears the old figures at once.
 */
export function useAnalytics(range: AnalyticsRange, intervalMs = 5000): { data: Analytics | null; error: string | null } {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    const load = async () => {
      try {
        const body = await getJSON<Analytics>(`/api/analytics?range=${range}`);
        if (alive) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void load();
    const id = setInterval(() => void load(), intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [range, intervalMs]);

  return { data, error };
}
