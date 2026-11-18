import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { sendCommand, type Settings } from "../lib/api";
import { fromTimeValue, toTimeValue } from "../lib/format";
import { CardHead, Spinner } from "./ui";

type Props = { device: number; settings: Settings; onSaved: () => void };

type Draft = {
  pagi: string;
  sore: string;
  durasi_pakan: string;
  durasi_pompa: string;
  batas_air: string;
  target_air: string;
  batas_pakan: string;
  air_kering: string;
  air_basah: string;
  pakan_penuh_mm: string;
  pakan_kosong_mm: string;
};

type NumKey = Exclude<keyof Draft, "pagi" | "sore">;
type Field = { key: NumKey; label: string; hint?: string; min: number; max: number; unit: string };

const FEED: Field[] = [
  { key: "durasi_pakan", label: "Servo terbuka", hint: "lama pakan dijatuhkan", min: 1, max: 10, unit: "detik" },
  { key: "batas_pakan", label: "Ambang pakan", hint: "peringatan stok menipis", min: 5, max: 95, unit: "%" },
];

const WATER: Field[] = [
  { key: "batas_air", label: "Pompa menyala di bawah", hint: "ambang air rendah", min: 5, max: 95, unit: "%" },
  { key: "target_air", label: "Pompa mengisi sampai", hint: "harus di atas ambang", min: 10, max: 95, unit: "%" },
  { key: "durasi_pompa", label: "Pompa maksimal", hint: "lalu berhenti sendiri", min: 1, max: 60, unit: "detik" },
];

/**
 * Calibration is edited here rather than compiled into the firmware, so moving
 * a sensor or swapping the hopper costs one save instead of a re-flash.
 */
const CALIBRATION: Field[] = [
  { key: "air_kering", label: "Air, titik 0%", hint: "ADC saat sensor kering", min: 0, max: 500, unit: "ADC" },
  { key: "air_basah", label: "Air, titik 100%", hint: "ADC pada tinggi maksimal aman", min: 20, max: 1023, unit: "ADC" },
  { key: "pakan_penuh_mm", label: "Pakan, titik 100%", hint: "jarak sensor saat penuh", min: 20, max: 600, unit: "mm" },
  { key: "pakan_kosong_mm", label: "Pakan, titik 0%", hint: "jarak sensor saat kosong", min: 20, max: 600, unit: "mm" },
];

const NUMERIC = [...FEED, ...WATER, ...CALIBRATION];

function draftFrom(s: Settings): Draft {
  return {
    pagi: toTimeValue(s.jam_pagi, s.menit_pagi),
    sore: toTimeValue(s.jam_sore, s.menit_sore),
    durasi_pakan: String(s.durasi_pakan ?? 3),
    durasi_pompa: String(s.durasi_pompa ?? 5),
    batas_air: String(s.batas_air ?? 30),
    target_air: String(s.target_air ?? 80),
    batas_pakan: String(s.batas_pakan ?? 30),
    air_kering: String(s.air_kering ?? 10),
    air_basah: String(s.air_basah ?? 210),
    pakan_penuh_mm: String(s.pakan_penuh_mm ?? 35),
    pakan_kosong_mm: String(s.pakan_kosong_mm ?? 82),
  };
}

function invalid(f: Field, raw: string): boolean {
  const n = Number(raw);
  return raw === "" || !Number.isInteger(n) || n < f.min || n > f.max;
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <fieldset className="grid min-w-0 gap-4 border-t border-line py-6 first:border-t-0 first:pt-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true">
        <p className="text-[0.88rem] font-semibold">{title}</p>
        <p className="mt-1.5 max-w-[34ch] text-xs leading-relaxed text-muted">{hint}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">{children}</div>
    </fieldset>
  );
}

function NumberField({ f, value, onChange }: { f: Field; value: string; onChange: (v: string) => void }) {
  const bad = invalid(f, value);
  const bump = (d: number) => onChange(String(Math.min(f.max, Math.max(f.min, (Number(value) || f.min) + d))));
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[0.8rem] font-medium">{f.label}</span>
        <span className="tnum font-mono text-[0.64rem] text-faint">
          {f.min}–{f.max}
        </span>
      </span>
      <span className="field mt-2" data-invalid={bad}>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Kurangi ${f.label}`}
          onClick={() => bump(-1)}
          className="flex h-full w-9 shrink-0 items-center justify-center text-muted transition-colors hover:text-fg"
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={f.min}
          max={f.max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={bad}
          className="text-center"
        />
        <span className="shrink-0 font-mono text-[0.7rem] text-muted">{f.unit}</span>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Tambah ${f.label}`}
          onClick={() => bump(1)}
          className="flex h-full w-9 shrink-0 items-center justify-center text-muted transition-colors hover:text-fg"
        >
          <Plus size={14} />
        </button>
      </span>
      {f.hint && <span className="mt-1.5 block text-[0.7rem] leading-snug text-faint">{f.hint}</span>}
    </label>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [h = "", m = ""] = value.split(":");

  const part = (max: number, current: string, build: (digits: string) => string) => ({
    value: current,
    inputMode: "numeric" as const,
    maxLength: 2,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
      if (digits !== "" && Number(digits) > max) return;
      onChange(build(digits));
    },
    onBlur: () => {
      if (current.length === 1) onChange(build(current.padStart(2, "0")));
    },
  });

  return (
    <div>
      <span className="block text-[0.8rem] font-medium" id={`t-${label}`}>
        {label}
      </span>
      <span className="field mt-2 justify-center gap-0.5 px-3" data-invalid={fromTimeValue(value) === null} role="group" aria-labelledby={`t-${label}`}>
        <input
          {...part(23, h, (d) => `${d}:${m}`)}
          aria-label={`${label}, jam`}
          placeholder="00"
          className="!w-11 text-center !text-[1.05rem] !font-medium"
        />
        <span className="pb-px font-mono text-base text-muted" aria-hidden="true">
          :
        </span>
        <input
          {...part(59, m, (d) => `${h}:${d}`)}
          aria-label={`${label}, menit`}
          placeholder="00"
          className="!w-11 text-center !text-[1.05rem] !font-medium"
        />
      </span>
    </div>
  );
}

export function SettingsStudio({ device, settings, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(settings));
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  // True from the first keystroke until a successful save. Every poll hands over a
  // fresh settings object, so without this flag the form would be overwritten with
  // the stored values every few seconds while the user is still typing.
  const [touched, setTouched] = useState(false);
  const baseline = useMemo(() => draftFrom(settings), [settings]);

  useEffect(() => {
    if (!touched) setDraft(baseline);
  }, [baseline, touched]);

  const changed = (Object.keys(draft) as Array<keyof Draft>).filter((k) => draft[k] !== baseline[k]).length;

  function edit(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setTouched(true);
    setState("idle");
    setError(null);
  }

  function discard() {
    setDraft(baseline);
    setTouched(false);
    setError(null);
  }

  async function submit() {
    setError(null);

    const pagi = fromTimeValue(draft.pagi);
    const sore = fromTimeValue(draft.sore);
    if (!pagi || !sore) {
      setError("Jam pakan belum terisi benar.");
      return;
    }

    const payload: Record<string, number> = {
      jam_pagi: pagi.hour,
      menit_pagi: pagi.minute,
      jam_sore: sore.hour,
      menit_sore: sore.minute,
    };

    for (const f of NUMERIC) {
      if (invalid(f, draft[f.key])) {
        setError(`${f.label} harus bilangan bulat ${f.min}–${f.max}.`);
        return;
      }
      payload[f.key] = Number(draft[f.key]);
    }

    setState("saving");
    try {
      await sendCommand(device, "settings", payload);
      setTouched(false);
      setState("saved");
      onSaved();
      setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 3200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setelan gagal disimpan");
      setState("idle");
    }
  }

  const barVisible = changed > 0 || state === "saved" || error !== null;

  return (
    <section className="card rise p-5" style={{ "--i": 9 } as CSSProperties} id="setelan">
      <CardHead title="Setelan" meta="disimpan di server dan dikirim ke alat pada laporan berikutnya, jadi bertahan walau alat sempat mati" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mt-4"
      >
        <Section title="Pakan" hint="Dua jadwal harian otomatis. Sensor jarak hanya membedakan sekitar 20%, jadi ambang bergerak dalam anak tangga.">
          <TimeField label="Pakan pagi" value={draft.pagi} onChange={(v) => edit({ pagi: v })} />
          <TimeField label="Pakan sore" value={draft.sore} onChange={(v) => edit({ sore: v })} />
          {FEED.map((f) => (
            <NumberField key={f.key} f={f} value={draft[f.key]} onChange={(v) => edit({ [f.key]: v })} />
          ))}
        </Section>

        <Section title="Pompa air" hint="Pompa menyala saat air di bawah ambang dan berhenti di target. Bila air tetap rendah setelah batas waktu, pompa terkunci.">
          {WATER.map((f) => (
            <NumberField key={f.key} f={f} value={draft[f.key]} onChange={(v) => edit({ [f.key]: v })} />
          ))}
          <p className="col-span-2 self-center rounded-lg border border-dashed border-line-strong px-4 py-3 text-xs leading-relaxed text-muted md:col-span-1">
            Pompa menyala saat air di bawah <b className="tnum font-semibold text-fg">{draft.batas_air}%</b>, mengisi sampai{" "}
            <b className="tnum font-semibold text-fg">{draft.target_air}%</b>, dan berhenti sendiri setelah{" "}
            <b className="tnum font-semibold text-fg">{draft.durasi_pompa} detik</b>.
          </p>
        </Section>

        <Section
          title="Kalibrasi sensor"
          hint="Dua titik per sensor, diukur langsung pada alat. Keduanya batas operasi, bukan batas fisik: 100% berarti setinggi yang masih aman, bukan tangki luber."
        >
          {CALIBRATION.map((f) => (
            <NumberField key={f.key} f={f} value={draft[f.key]} onChange={(v) => edit({ [f.key]: v })} />
          ))}
        </Section>

        {/* Floating save bar: unsaved edits are the one thing on this page that must not be missed. */}
        <div
          className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-all duration-500"
          style={{ opacity: barVisible ? 1 : 0, transform: barVisible ? "none" : "translateY(24px)" }}
          aria-hidden={!barVisible}
        >
          <div
            className="pointer-events-auto flex w-full max-w-[640px] flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-xl border border-line-strong bg-surface py-2.5 pl-5 pr-2.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.55)]"
            role="status"
          >
            <p className="flex items-center gap-2.5 text-sm" style={{ color: error ? "var(--danger)" : state === "saved" ? "var(--ok)" : undefined }}>
              {state === "saved" && !error ? (
                <>
                  <Check size={16} strokeWidth={3} /> Tersimpan, menunggu alat mengambilnya
                </>
              ) : error ? (
                error
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-warn" aria-hidden="true" />
                  {changed} perubahan belum disimpan
                </>
              )}
            </p>
            <div className="flex gap-2">
              {changed > 0 && state !== "saved" && (
                <button type="button" onClick={discard} className="btn !min-h-10 !px-4" disabled={state === "saving"} tabIndex={barVisible ? 0 : -1}>
                  Batalkan
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary !min-h-10 !px-5"
                disabled={state !== "idle" || changed === 0}
                tabIndex={barVisible ? 0 : -1}
              >
                {state === "saving" ? <Spinner /> : null}
                {state === "saving" ? "Menyimpan…" : "Simpan setelan"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
