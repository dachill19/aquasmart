import { useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { MetricBlock, type ContextRow } from "./components/MetricBlock";
import { ControlBlock } from "./components/ControlBlock";
import { RecordTable } from "./components/RecordTable";
import { HistoryChart } from "./components/HistoryChart";
import { SettingsPanel } from "./components/SettingsPanel";
import { OFFLINE_AFTER_MS, useTelemetry } from "./lib/api";
import { COMMAND_LABEL, formatClock, formatNumber, formatUptime, toTimeValue } from "./lib/format";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("aquasmart-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Private windows and blocked storage are normal; fall through to the system.
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Which scheduled feeding comes next, read off the device's own settings. */
function nextFeeding(settings: Record<string, number>, now: number): string {
  const pagi = toTimeValue(settings.jam_pagi, settings.menit_pagi);
  const sore = toTimeValue(settings.jam_sore, settings.menit_sore);
  const d = new Date(now);
  const minutesNow = d.getHours() * 60 + d.getMinutes();
  const asMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  // "HH:MM" sorts as text, so this also holds when the evening slot is set earlier than the morning one.
  const [first, second] = [pagi, sore].sort();
  if (minutesNow < asMinutes(first)) return first;
  if (minutesNow < asMinutes(second)) return second;
  return `${first} besok`;
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [now, setNow] = useState(() => Date.now());
  const { latest, history, error, loading, refresh } = useTelemetry();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("aquasmart-theme", theme);
    } catch {
      // Not being able to remember the choice is not worth an error.
    }
  }, [theme]);

  // The "last heard from" line has to keep counting even when nothing arrives.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const reading = latest?.reading ?? null;
  const settings = latest?.settings ?? {};
  const commands = latest?.commands ?? [];
  const pendingTypes = useMemo(
    () => new Set(commands.filter((c) => c.acked_at === null && !c.expired).map((c) => c.type)),
    [commands]
  );

  const age = reading ? now - reading.ts : null;
  const offline = age === null || age > OFFLINE_AFTER_MS;
  const batasAir = settings.batas_air ?? 30;
  const targetAir = settings.target_air ?? 80;
  const batasPakan = settings.batas_pakan ?? 30;

  // Spoken result of the page's primary action, for anyone not watching the table.
  const announcement = useMemo(() => {
    const newest = commands[0];
    if (!newest) return "";
    const label = COMMAND_LABEL[newest.type] ?? newest.type;
    if (newest.expired) return `${label} kedaluwarsa, alat tidak mengambilnya dalam 10 menit.`;
    return newest.acked_at === null
      ? `${label} menunggu diambil alat.`
      : `${label} disahkan alat pukul ${formatClock(newest.acked_at)}.`;
  }, [commands]);

  const pompaText = reading?.terkunci ? "Terkunci" : reading?.pompa ? "Menyala" : "Mati";

  const waterRows: ContextRow[] = [
    { k: "Status", v: reading?.status_air || "—" },
    { k: "Pompa", v: reading ? pompaText : "—" },
    { k: "Pembacaan", v: reading ? `pukul ${formatClock(reading.ts)}` : "—" },
  ];

  const feedRows: ContextRow[] = [
    { k: "Status", v: reading?.status_pakan || "—" },
    { k: "Pakan berikutnya", v: nextFeeding(settings, now) },
    // The calibrated span, not a claimed accuracy figure: it is the number the
    // operator needs while setting the two points, and it is actually known.
    {
      k: "Rentang kalibrasi",
      v:
        settings.pakan_penuh_mm && settings.pakan_kosong_mm
          ? `${settings.pakan_penuh_mm}–${settings.pakan_kosong_mm} mm`
          : "—",
    },
  ];

  return (
    <div className="min-h-screen">
      <Header
        lastSeen={reading?.ts ?? null}
        now={now}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error && (
        <p
          role="alert"
          className="border-b border-[var(--stamp)] bg-[var(--panel)] px-6 py-3 text-sm sm:px-10"
          style={{ color: "var(--stamp)" }}
        >
          Gagal menghubungi server: {error}. Angka di bawah mungkin sudah usang.
        </p>
      )}

      {!loading && reading === null && !error && (
        <p className="border-b border-[var(--rule)] bg-[var(--panel)] px-6 py-3 text-sm text-[var(--ink-muted)] sm:px-10">
          Alat belum pernah melapor. Semua tombol tetap bisa ditekan, dan perintahnya akan menunggu
          sampai alat terhubung.
        </p>
      )}

      {!loading && reading !== null && offline && (
        <p className="border-b border-[var(--rule)] bg-[var(--panel)] px-6 py-3 text-sm sm:px-10">
          <span style={{ color: "var(--stamp)" }}>Alat sedang tidak terhubung.</span>{" "}
          <span className="text-[var(--ink-muted)]">
            Angka di bawah adalah pembacaan terakhir yang tersimpan, bukan kondisi saat ini.
          </span>
        </p>
      )}

      <main className="mx-auto max-w-[1680px]">
        <div className="grid border-b border-[var(--rule)] lg:grid-cols-[1fr_1fr_minmax(300px,360px)]">
          <MetricBlock
            label="Ketinggian air"
            value={reading?.level_air ?? null}
            threshold={batasAir}
            readout={`ADC ${reading?.raw_water ?? "—"}`}
            emptyNote="belum ada pembacaan"
            rows={waterRows}
          />
          <MetricBlock
            label="Stok pakan"
            value={reading?.stok_pakan ?? null}
            threshold={batasPakan}
            // Millimetres, the same unit the calibration fields take, so
            // reading this figure and typing it in needs no conversion.
            readout={`jarak ${
              reading?.jarak_pakan !== null && reading?.jarak_pakan !== undefined
                ? `${formatNumber(reading.jarak_pakan * 10)} mm`
                : "—"
            }`}
            emptyNote="belum ada pembacaan"
            rows={feedRows}
          />
          <ControlBlock
            settings={settings}
            pumpOn={Boolean(reading?.pompa)}
            locked={Boolean(reading?.terkunci)}
            pendingTypes={pendingTypes}
            onSent={refresh}
          />
        </div>

        <section className="grid gap-x-10 gap-y-4 border-b border-[var(--rule)] px-6 py-5 font-mono text-sm sm:grid-cols-3 sm:px-10">
          <p>
            <span className="label">Sinyal WiFi</span>
            <span className="tnum mt-1 block">
              {reading?.rssi !== null && reading?.rssi !== undefined ? `${reading.rssi} dBm` : "—"}
            </span>
          </p>
          <p>
            <span className="label">Alat menyala</span>
            <span className="tnum mt-1 block">{formatUptime(reading?.uptime_ms ?? null)}</span>
          </p>
          <p>
            <span className="label">Perintah menunggu</span>
            <span className="tnum mt-1 block">
              {pendingTypes.size === 0 ? "tidak ada" : `${pendingTypes.size} perintah`}
            </span>
          </p>
        </section>

        <RecordTable events={latest?.events ?? []} commands={commands} settings={settings} />

        <HistoryChart points={history} thresholdAir={batasAir} targetAir={targetAir} />

        <SettingsPanel settings={settings} onSaved={refresh} />
      </main>

      <footer className="border-t border-[var(--rule)] px-6 py-6 font-mono text-xs text-[var(--ink-muted)] sm:px-10">
        AQUASMART · prototipe akuarium pintar · data disimpan di Cloudflare D1 (APAC)
      </footer>
    </div>
  );
}
