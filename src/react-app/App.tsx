import { useEffect, useMemo, useState } from "react";
import { Droplets, Fish, TriangleAlert, WifiOff } from "lucide-react";
import { Activity } from "./components/Activity";
import { ControlDeck } from "./components/ControlDeck";
import { SettingsStudio } from "./components/SettingsStudio";
import { StatusHero } from "./components/StatusHero";
import { TopBar } from "./components/TopBar";
import { TrendChart } from "./components/TrendChart";
import { VesselCard } from "./components/VesselCard";
import { Vitals } from "./components/Vitals";
import { FeedHopper } from "./components/vessels/FeedHopper";
import { WaterTank } from "./components/vessels/WaterTank";
import { OFFLINE_AFTER_MS, useTelemetry } from "./lib/api";
import { COMMAND_LABEL, formatClock, formatNumber } from "./lib/format";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("aquasmart-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Private windows and blocked storage are normal; fall through to dark, the primary theme.
  }
  return "dark";
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [now, setNow] = useState(() => Date.now());
  const { latest, history, error, loading, refresh } = useTelemetry();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#050c18" : "#eaf1f8");
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
  const pendingCount = commands.filter((c) => c.acked_at === null && !c.expired).length;

  const offline = reading === null || now - reading.ts > OFFLINE_AFTER_MS;
  // Stale means there are numbers, but the device has stopped vouching for them.
  const stale = reading !== null && offline;
  const batasAir = settings.batas_air ?? 30;
  const targetAir = settings.target_air ?? 80;
  const batasPakan = settings.batas_pakan ?? 30;

  // Spoken result of the page's primary action, for anyone not watching the timeline.
  const announcement = useMemo(() => {
    const newest = commands[0];
    if (!newest) return "";
    const label = COMMAND_LABEL[newest.type] ?? newest.type;
    if (newest.expired) return `${label} kedaluwarsa, alat tidak mengambilnya dalam 10 menit.`;
    return newest.acked_at === null
      ? `${label} menunggu diambil alat.`
      : `${label} disahkan alat pukul ${formatClock(newest.acked_at)}.`;
  }, [commands]);

  const waterLow = reading?.level_air != null && reading.level_air < batasAir;
  const feedLow = reading?.stok_pakan != null && reading.stok_pakan < batasPakan;
  const distanceMm = reading?.jarak_pakan != null ? reading.jarak_pakan * 10 : null;

  return (
    <div className="min-h-screen pb-28">
      <TopBar
        lastSeen={reading?.ts ?? null}
        now={now}
        offline={offline}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <main className="mx-auto max-w-[1360px] px-4 sm:px-8">
        <StatusHero
          reading={reading}
          loading={loading}
          offline={offline}
          batasAir={batasAir}
          batasPakan={batasPakan}
          pending={pendingCount}
          now={now}
        />

        {error && (
          <p
            role="alert"
            className="slide-in mt-6 flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3.5 text-sm"
          >
            <TriangleAlert size={18} className="mt-px shrink-0 text-danger" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-danger">Gagal menghubungi server:</strong>{" "}
              <span className="text-muted">{error}. Angka di bawah mungkin sudah usang.</span>
            </span>
          </p>
        )}

        {stale && !error && (
          <p className="slide-in mt-6 flex items-start gap-3 rounded-2xl border border-line-strong bg-raised px-4 py-3.5 text-sm">
            <WifiOff size={18} className="mt-px shrink-0 text-muted" aria-hidden="true" />
            <span className="text-muted">
              Tampilan dibekukan pada pembacaan pukul <span className="tnum font-medium text-fg">{formatClock(reading.ts)}</span>. Tangki dan
              wadah di bawah menunjukkan keadaan saat itu, bukan sekarang.
            </span>
          </p>
        )}

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <VesselCard
            index={0}
            icon={<Droplets size={18} />}
            label="Ketinggian air"
            value={reading?.level_air ?? null}
            loading={loading}
            stale={stale}
            critical={waterLow && !stale}
            status={reading ? { text: reading.status_air || (waterLow ? "Rendah" : "Aman"), tone: waterLow ? "danger" : "ok" } : null}
            readout={[`ADC ${reading?.raw_water ?? "—"}`, `rentang ${settings.air_kering ?? "—"}–${settings.air_basah ?? "—"} ADC`]}
            visual={
              <WaterTank
                level={reading?.level_air ?? null}
                threshold={batasAir}
                target={targetAir}
                pumpOn={Boolean(reading?.pompa) && !stale}
                locked={Boolean(reading?.terkunci)}
                stale={stale}
              />
            }
            stats={[
              { k: "Ambang", v: `${batasAir}%` },
              { k: "Target isi", v: `${targetAir}%` },
              { k: "Pembacaan", v: reading ? formatClock(reading.ts) : "—" },
            ]}
          />

          <VesselCard
            index={1}
            icon={<Fish size={18} />}
            label="Stok pakan"
            value={reading?.stok_pakan ?? null}
            loading={loading}
            stale={stale}
            critical={feedLow && !stale}
            status={reading ? { text: reading.status_pakan || (feedLow ? "Menipis" : "Cukup"), tone: feedLow ? "warn" : "ok" } : null}
            // Millimetres, the same unit the calibration fields take, so reading this
            // figure and typing it in needs no conversion.
            readout={[`jarak ${distanceMm !== null ? `${formatNumber(distanceMm)} mm` : "—"}`, `rentang ${settings.pakan_penuh_mm ?? "—"}–${settings.pakan_kosong_mm ?? "—"} mm`]}
            visual={<FeedHopper level={reading?.stok_pakan ?? null} threshold={batasPakan} distanceMm={distanceMm} stale={stale} />}
            stats={[
              { k: "Ambang", v: `${batasPakan}%` },
              { k: "Servo", v: `${settings.durasi_pakan ?? 3} dtk` },
              { k: "Pembacaan", v: reading ? formatClock(reading.ts) : "—" },
            ]}
            note="Sensor jarak hanya membedakan sekitar lima tingkat (±20%), jadi angka ini bergerak dalam anak tangga."
          />

        </div>

        <div className="mt-5">
          <ControlDeck
            settings={settings}
            pumpOn={Boolean(reading?.pompa)}
            locked={Boolean(reading?.terkunci)}
            offline={offline}
            commands={commands}
            pendingTypes={pendingTypes}
            onSent={refresh}
          />
        </div>

        <div className="mt-5">
          <Vitals reading={reading} settings={settings} now={now} stale={stale} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <TrendChart points={history} thresholdAir={batasAir} targetAir={targetAir} />
          <Activity events={latest?.events ?? []} commands={commands} settings={settings} />
        </div>

        <div className="mt-5">
          <SettingsStudio settings={settings} onSaved={refresh} />
        </div>
      </main>

      <footer className="mx-auto mt-14 flex max-w-[1360px] flex-wrap items-center justify-between gap-4 border-t border-line px-4 pt-7 text-xs text-muted sm:px-8">
        <span className="flex items-center gap-2.5">
          <img src="/logo-mark.png" alt="" width={20} height={20} className="h-5 w-5 object-contain opacity-80" />
          <span>
            <strong className="font-semibold text-fg">AQUASMART</strong> · prototipe akuarium pintar
          </span>
        </span>
        <span>Informatika UNS · data tersimpan di Cloudflare D1</span>
      </footer>
    </div>
  );
}
