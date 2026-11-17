import { useState } from "react";
import { Droplets, LockOpen, Power, UtensilsCrossed } from "lucide-react";
import { sendCommand, type Settings } from "../lib/api";
import { toTimeValue } from "../lib/format";

type Props = {
  settings: Settings;
  pumpOn: boolean;
  locked: boolean;
  pendingTypes: Set<string>;
  onSent: () => void;
};

type Action = {
  key: string;
  label: string;
  hint: string;
  icon: typeof UtensilsCrossed;
  run: () => Promise<void>;
  primary?: boolean;
};

export function ControlBlock({ settings, pumpOn, locked, pendingTypes, onSent }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions: Action[] = [
    {
      key: "feed",
      label: "Beri pakan sekarang",
      hint: `servo ${settings.durasi_pakan ?? 3} detik`,
      icon: UtensilsCrossed,
      primary: true,
      run: () => sendCommand("feed"),
    },
    {
      key: "pump",
      label: pumpOn ? "Matikan pompa" : "Nyalakan pompa",
      hint: `maksimal ${settings.durasi_pompa ?? 10} detik`,
      icon: pumpOn ? Power : Droplets,
      run: () => sendCommand("pump", { on: !pumpOn }),
    },
    {
      key: "unlock",
      label: "Buka kunci pompa",
      hint: locked ? "pompa sedang terkunci" : "tidak terkunci",
      icon: LockOpen,
      run: () => sendCommand("unlock"),
    },
  ];

  async function fire(action: Action) {
    setBusy(action.key);
    setError(null);
    try {
      await action.run();
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Perintah gagal dikirim");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="border-b border-[var(--rule)] bg-[var(--panel)] px-6 py-7 sm:px-10 lg:border-b-0">
      <h2 className="label">Tindakan</h2>

      <div className="mt-4 space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const waiting = pendingTypes.has(action.key);
          // Unlocking a pump that is not locked only queues a command that does nothing.
          const disabled = busy !== null || (action.key === "unlock" && !locked);
          return (
            <button
              key={action.key}
              type="button"
              disabled={disabled}
              onClick={() => void fire(action)}
              className="flex w-full items-center gap-3 border px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55"
              style={{
                background: action.primary ? "var(--blue)" : "var(--panel-2)",
                borderColor: action.primary ? "var(--blue-live)" : "var(--rule)",
                color: action.primary ? "#f2f7fc" : "var(--ink)",
              }}
            >
              <Icon size={18} strokeWidth={2} className="shrink-0" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{action.label}</span>
                <span
                  className="mt-0.5 block font-mono text-xs"
                  style={{ color: action.primary ? "#bcd6ec" : "var(--ink-muted)" }}
                >
                  {busy === action.key ? "mengirim…" : waiting ? "menunggu alat" : action.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 border border-[var(--stamp)] px-3 py-2 text-sm"
          style={{ color: "var(--stamp)" }}
        >
          {error}
        </p>
      )}

      <h2 className="label mt-8">Jadwal pakan</h2>
      <p className="tnum mt-2 font-mono text-2xl font-medium tracking-wide">
        {toTimeValue(settings.jam_pagi, settings.menit_pagi)}
        <span className="mx-3 text-[var(--ink-muted)]">&middot;</span>
        {toTimeValue(settings.jam_sore, settings.menit_sore)}
      </p>
      <p className="mt-1 font-mono text-xs text-[var(--ink-muted)]">
        pompa {settings.batas_air ?? 30}% &rarr; {settings.target_air ?? 80}% &middot; ambang pakan{" "}
        {settings.batas_pakan ?? 30}%
      </p>
    </section>
  );
}
