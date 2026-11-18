import { useEffect, useMemo, useState } from "react";
import { TriangleAlert, WifiOff } from "lucide-react";
import { Activity } from "./components/Activity";
import { ControlDeck } from "./components/ControlDeck";
import { FleetStrip } from "./components/FleetStrip";
import { SettingsStudio } from "./components/SettingsStudio";
import { StatusHero } from "./components/StatusHero";
import { TopBar, type Page } from "./components/TopBar";
import { AnalyticsPage } from "./components/AnalyticsPage";
import { TrendChart } from "./components/TrendChart";
import { VesselCard } from "./components/VesselCard";
import { Sparkline } from "./components/Sparkline";
import { Vitals } from "./components/Vitals";
import { FeedHopper } from "./components/vessels/FeedHopper";
import { WaterTank } from "./components/vessels/WaterTank";
import { OFFLINE_AFTER_MS, useDevices, useTelemetry, type AnalyticsRange } from "./lib/api";
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

/** Kept in the URL, so a refresh or a shared link opens the same aquarium. */
const PARAM = "akuarium";

function initialDevice(): number {
  const n = Number(new URLSearchParams(window.location.search).get(PARAM));
  return Number.isInteger(n) && n > 0 ? n : 1;
}

const pageFromPath = (): Page => (window.location.pathname.replace(/\/+$/, "") === "/analitik" ? "analitik" : "akuarium");

export default function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [now, setNow] = useState(() => Date.now());
  const [device, setDevice] = useState(initialDevice);
  const [page, setPage] = useState<Page>(pageFromPath);
  const [range, setRange] = useState<AnalyticsRange>("1h");
  const { devices, loaded: devicesLoaded } = useDevices();

  function navigate(next: Page) {
    if (next === page) return;
    setPage(next);
    const query = device === 1 ? "" : `?${PARAM}=${device}`;
    window.history.pushState(null, "", next === "analitik" ? "/analitik" : `/${query}`);
    window.scrollTo({ top: 0 });
  }

  // The browser's back and forward buttons move between the two pages.
  useEffect(() => {
    const onPop = () => setPage(pageFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const { latest, history, error, loading, refresh } = useTelemetry(device);

  function selectDevice(id: number) {
    setDevice(id);
    const url = new URL(window.location.href);
    if (id === 1) url.searchParams.delete(PARAM);
    else url.searchParams.set(PARAM, String(id));
    window.history.replaceState(null, "", url);
  }

  // An id from an old link or a typo falls back to the real aquarium instead of a blank page.
  useEffect(() => {
    if (devicesLoaded && devices.length > 0 && !devices.some((d) => d.id === device)) selectDevice(1);
    // selectDevice only touches state and the URL; depending on it would re-run every render.
  }, [devicesLoaded, devices, device]);

  const current = devices.find((d) => d.id === device);

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
  const trendSpan =
    history.length >= 2 ? `${Math.max(1, Math.round((history[history.length - 1].ts - history[0].ts) / 60000))} menit terakhir` : "";
  const distanceMm = reading?.jarak_pakan != null ? reading.jarak_pakan * 10 : null;

  const fleetOnline = devices.filter((d) => d.ts !== null && now - d.ts <= OFFLINE_AFTER_MS).length;
  const fleetLastSeen = devices.reduce<number | null>((m, d) => (d.ts !== null && (m === null || d.ts > m) ? d.ts : m), null);

  return (
    <div className="min-h-screen pb-24">
      <TopBar
        lastSeen={page === "analitik" ? fleetLastSeen : (reading?.ts ?? null)}
        now={now}
        offline={page === "analitik" ? fleetOnline === 0 : offline}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        page={page}
        onNavigate={navigate}
        presence={page === "analitik" && devices.length ? `${fleetOnline}/${devices.length} akuarium online` : undefined}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <main className="mx-auto max-w-[2200px] px-4 sm:px-6 xl:px-8">
        {page === "analitik" ? (
          <AnalyticsPage range={range} onRange={setRange} now={now} />
        ) : (
          <>
        <FleetStrip devices={devices} selected={device} now={now} onSelect={selectDevice} />

        <StatusHero
          reading={reading}
          loading={loading}
          offline={offline}
          batasAir={batasAir}
          batasPakan={batasPakan}
          pending={pendingCount}
          now={now}
          name={current?.name ?? `Akuarium ${String(device).padStart(2, "0")}`}
          simulated={Boolean(current?.simulated)}
        />

        {error && (
          <p
            role="alert"
            className="slide-in mt-4 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm"
          >
            <TriangleAlert size={18} className="mt-px shrink-0 text-danger" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-danger">Gagal menghubungi server:</strong>{" "}
              <span className="text-muted">{error}. Angka di bawah mungkin sudah usang.</span>
            </span>
          </p>
        )}

        {stale && !error && (
          <p className="slide-in mt-4 flex items-start gap-3 rounded-xl border border-line-strong bg-raised px-4 py-3 text-sm">
            <WifiOff size={18} className="mt-px shrink-0 text-muted" aria-hidden="true" />
            <span className="text-muted">
              Tampilan dibekukan pada pembacaan pukul <span className="tnum font-medium text-fg">{formatClock(reading.ts)}</span>. Tangki dan
              wadah di bawah menunjukkan keadaan saat itu, bukan sekarang.
            </span>
          </p>
        )}

        <div className="mt-5 grid gap-4 xl:grid-cols-2 3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_390px]">
          <VesselCard
            index={0}
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
            trend={
              <>
                <p className="label mb-1.5">{trendSpan}</p>
                <Sparkline values={history.map((p) => p.level_air)} color="var(--accent)" threshold={batasAir} label="Tren ketinggian air" />
              </>
            }
            stats={[
              { k: "Ambang", v: `${batasAir}%` },
              { k: "Target isi", v: `${targetAir}%` },
              { k: "Pembacaan", v: reading ? formatClock(reading.ts) : "—" },
            ]}
          />

          <VesselCard
            index={1}
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
            trend={
              <>
                <p className="label mb-1.5">{trendSpan}</p>
                <Sparkline values={history.map((p) => p.stok_pakan)} color="var(--feed)" step threshold={batasPakan} label="Tren stok pakan" />
              </>
            }
            stats={[
              { k: "Ambang", v: `${batasPakan}%` },
              { k: "Servo", v: `${settings.durasi_pakan ?? 3} dtk` },
              { k: "Pembacaan", v: reading ? formatClock(reading.ts) : "—" },
            ]}
            note="Sensor jarak hanya membedakan sekitar lima tingkat (±20%), jadi angka ini bergerak dalam anak tangga."
          />

          <div className="xl:col-span-2 3xl:col-span-1">
            <ControlDeck
              device={device}
              settings={settings}
              pumpOn={Boolean(reading?.pompa)}
              locked={Boolean(reading?.terkunci)}
              offline={offline}
              commands={commands}
              pendingTypes={pendingTypes}
              onSent={refresh}
            />
          </div>
        </div>

        <div className="mt-4">
          <Vitals reading={reading} settings={settings} now={now} stale={stale} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <TrendChart points={history} thresholdAir={batasAir} targetAir={targetAir} />
          <Activity events={latest?.events ?? []} commands={commands} settings={settings} />
        </div>

        <div className="mt-4">
          {/* Keyed by aquarium: unsaved edits are dropped on a switch, never saved to the newly selected tank. */}
          <SettingsStudio key={device} device={device} settings={settings} onSaved={refresh} />
        </div>
          </>
        )}
      </main>

      <footer className="mx-auto mt-10 flex max-w-[2200px] flex-wrap items-center justify-between gap-4 border-t border-line px-4 pt-5 text-xs text-muted sm:px-6 xl:px-8">
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
