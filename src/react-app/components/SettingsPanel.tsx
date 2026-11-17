import { Fragment, useEffect, useState } from "react";
import { sendCommand, type Settings } from "../lib/api";
import { fromTimeValue, toTimeValue } from "../lib/format";

type Props = { settings: Settings; onSaved: () => void };

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

type Field = { key: keyof Draft; label: string; min: number; max: number; unit: string };

const NUMERIC: Field[] = [
  { key: "durasi_pakan", label: "Durasi buka servo", min: 1, max: 10, unit: "detik" },
  { key: "durasi_pompa", label: "Pompa maksimal", min: 1, max: 60, unit: "detik" },
  { key: "batas_air", label: "Pompa menyala di bawah", min: 5, max: 95, unit: "%" },
  { key: "target_air", label: "Pompa mengisi sampai", min: 10, max: 95, unit: "%" },
  { key: "batas_pakan", label: "Ambang pakan", min: 5, max: 95, unit: "%" },
];

/**
 * Calibration is edited here rather than compiled into the firmware, so moving
 * a sensor or swapping the hopper costs one save instead of a re-flash.
 */
const KALIBRASI: Field[] = [
  { key: "air_kering", label: "Air — titik 0%", min: 0, max: 500, unit: "ADC" },
  { key: "air_basah", label: "Air — titik 100%", min: 20, max: 1023, unit: "ADC" },
  { key: "pakan_penuh_mm", label: "Pakan — titik 100%", min: 20, max: 600, unit: "mm" },
  { key: "pakan_kosong_mm", label: "Pakan — titik 0%", min: 20, max: 600, unit: "mm" },
];

function draftFrom(s: Settings): Draft {
  return {
    pagi: toTimeValue(s.jam_pagi, s.menit_pagi),
    sore: toTimeValue(s.jam_sore, s.menit_sore),
    durasi_pakan: String(s.durasi_pakan ?? 3),
    durasi_pompa: String(s.durasi_pompa ?? 10),
    batas_air: String(s.batas_air ?? 30),
    target_air: String(s.target_air ?? 80),
    batas_pakan: String(s.batas_pakan ?? 30),
    air_kering: String(s.air_kering ?? 10),
    air_basah: String(s.air_basah ?? 250),
    pakan_penuh_mm: String(s.pakan_penuh_mm ?? 60),
    pakan_kosong_mm: String(s.pakan_kosong_mm ?? 109),
  };
}

export function SettingsPanel({ settings, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(settings));
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  // True from the first keystroke until a successful save. Every poll hands over
  // a fresh settings object, so without this flag the form was overwritten with
  // the stored values every few seconds while the user was still typing.
  const [dirty, setDirty] = useState(false);

  // Settings can change from another browser; follow the server unless the user
  // has unsaved edits.
  useEffect(() => {
    if (!dirty) setDraft(draftFrom(settings));
  }, [settings, dirty]);

  function edit(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
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

    for (const field of [...NUMERIC, ...KALIBRASI]) {
      const n = Number(draft[field.key]);
      if (!Number.isInteger(n) || n < field.min || n > field.max) {
        setError(`${field.label} harus bilangan bulat ${field.min}–${field.max}.`);
        return;
      }
      payload[field.key] = n;
    }

    setState("saving");
    try {
      await sendCommand("settings", payload);
      setDirty(false);
      setState("saved");
      onSaved();
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setelan gagal disimpan");
      setState("idle");
    }
  }

  const field =
    "mt-1.5 w-full border border-[var(--rule)] bg-[var(--panel-2)] px-3 py-2.5 font-mono text-sm text-[var(--ink)]";

  return (
    <section className="border-t border-[var(--rule)] bg-[var(--panel)]">
      <div className="mx-auto max-w-[1680px] px-6 py-7 sm:px-10">
        <h2 className="label">Setelan</h2>
        <p className="mt-2 max-w-[70ch] text-sm text-[var(--ink-muted)]">
          Perubahan disimpan di server dan dikirim ke alat pada laporan berikutnya, jadi nilainya
          bertahan meski alat sempat mati.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mt-5 grid items-end gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        >
          <label className="block text-sm">
            <span className="label">Pakan pagi</span>
            <input
              type="time"
              value={draft.pagi}
              onChange={(e) => edit({ pagi: e.target.value })}
              className={field}
            />
          </label>

          <label className="block text-sm">
            <span className="label">Pakan sore</span>
            <input
              type="time"
              value={draft.sore}
              onChange={(e) => edit({ sore: e.target.value })}
              className={field}
            />
          </label>

          {[...NUMERIC, ...KALIBRASI].map((f) => (
            <Fragment key={f.key}>
              {f.key === KALIBRASI[0].key && (
                <div className="sm:col-span-2 lg:col-span-3 xl:col-span-6">
                  <h3 className="label border-t border-[var(--rule)] pt-6">Kalibrasi sensor</h3>
                  <p className="mt-2 max-w-[70ch] text-sm text-[var(--ink-muted)]">
                    Dua titik per sensor, diukur langsung pada alat. Keduanya adalah batas operasi,
                    bukan batas fisik: 0% berarti &ldquo;sudah waktunya diisi&rdquo; dan 100% berarti
                    &ldquo;setinggi yang masih aman&rdquo;, bukan tangki kosong dan tangki luber.
                    Angkanya dibaca di bawah kedua gauge &mdash; ADC untuk air, milimeter untuk pakan.
                  </p>
                </div>
              )}
              <label className="block text-sm">
                <span className="label">
                  {f.label} <span className="normal-case tracking-normal">({f.unit})</span>
                </span>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={draft[f.key]}
                  onChange={(e) => edit({ [f.key]: e.target.value })}
                  className={field}
                />
              </label>
            </Fragment>
          ))}

          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-6">
            <button
              type="submit"
              disabled={state === "saving"}
              className="border border-[var(--blue-live)] bg-[var(--blue)] px-6 py-3 text-sm font-semibold text-[#f2f7fc] disabled:opacity-60"
            >
              {state === "saving" ? "Menyimpan…" : "Simpan setelan"}
            </button>
            {state === "saved" && (
              <span className="ml-4 font-mono text-xs" style={{ color: "var(--ok)" }}>
                tersimpan, menunggu alat mengambilnya
              </span>
            )}
            {error && (
              <span role="alert" className="ml-4 font-mono text-xs" style={{ color: "var(--stamp)" }}>
                {error}
              </span>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
