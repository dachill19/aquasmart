import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, Droplets, Gamepad2, LockOpen, Power, UtensilsCrossed } from "lucide-react";
import { sendCommand, type CommandRow, type Settings } from "../lib/api";
import { COMMAND_LABEL, formatClock } from "../lib/format";
import { SectionTitle, Spinner } from "./ui";

type Props = {
  settings: Settings;
  pumpOn: boolean;
  locked: boolean;
  offline: boolean;
  commands: CommandRow[];
  pendingTypes: Set<string>;
  onSent: () => void;
};

type ActionProps = {
  icon: ReactNode;
  label: string;
  hint: string;
  waiting: boolean;
  sending: boolean;
  disabled: boolean;
  primary?: boolean;
  onClick: () => void;
};

function Action({ icon, label, hint, waiting, sending, disabled, primary, onClick }: ActionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      data-waiting={waiting || sending}
      onClick={onClick}
      className={`btn h-full w-full ${primary ? "btn-primary !justify-between !px-5 !py-[1.15rem]" : "!flex-col !items-start !justify-between !gap-3 !px-4 !py-4 text-left"}`}
    >
      {primary ? (
        <>
          <span className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">{icon}</span>
            <span className="text-left">
              <span className="block text-[1.02rem] leading-tight">{label}</span>
              <span className="mt-1 block text-xs font-medium text-white/75">
                {sending ? "Mengirim…" : waiting ? "Menunggu alat mengambil" : hint}
              </span>
            </span>
          </span>
          {sending || waiting ? <Spinner size={18} /> : <span className="text-lg text-white/70" aria-hidden="true">→</span>}
        </>
      ) : (
        <>
          <span className="flex w-full items-center justify-between text-accent">
            {icon}
            {(sending || waiting) && <Spinner />}
          </span>
          <span>
            <span className="block leading-tight">{label}</span>
            <span className="mt-1 block text-xs font-normal text-muted">
              {sending ? "Mengirim…" : waiting ? "Menunggu alat" : hint}
            </span>
          </span>
        </>
      )}
    </button>
  );
}

/** The newest command, drawn as the three states the server actually records. */
function Trace({ command }: { command: CommandRow }) {
  const steps = [
    { label: "Antre", at: command.ts },
    { label: "Diambil alat", at: command.sent_at },
    { label: "Dijalankan", at: command.acked_at },
  ];
  const reached = command.expired ? 1 : steps.filter((s) => s.at !== null).length;

  return (
    <div className="rounded-2xl border border-line bg-raised p-4" aria-label="Status perintah terakhir">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Perintah terakhir</p>
        <p className="text-[0.8rem] font-semibold">{COMMAND_LABEL[command.type] ?? command.type}</p>
      </div>

      <ol className="mt-4 grid grid-cols-3">
        {steps.map((s, i) => {
          const done = i < reached;
          const failed = command.expired && i === 1;
          return (
            <li key={s.label} className="relative flex flex-col items-center text-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1/2 top-[11px] h-0.5 w-full -translate-y-1/2 rounded-full transition-colors duration-500"
                  style={{ background: i < reached ? "var(--accent)" : "var(--line-strong)" }}
                />
              )}
              <span
                className="relative z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-colors duration-500"
                style={{
                  borderColor: failed ? "var(--danger)" : done ? "var(--accent)" : "var(--line-strong)",
                  background: done && !failed ? "var(--accent)" : "var(--bg)",
                  color: "#fff",
                }}
              >
                {done && !failed && <Check size={12} strokeWidth={3.2} />}
                {failed && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
                {!done && !failed && i === reached && !command.expired && <Spinner size={11} />}
              </span>
              <span className={`mt-2 text-[0.72rem] font-medium ${done ? "text-fg" : "text-faint"}`}>
                {failed ? "Kedaluwarsa" : s.label}
              </span>
              <span className="tnum mt-0.5 font-mono text-[0.66rem] text-muted">{s.at ? formatClock(s.at) : "—"}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ControlDeck({ settings, pumpOn, locked, offline, commands, pendingTypes, onSent }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fire(key: string, run: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await run();
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Perintah gagal dikirim");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card rise p-5 sm:p-7" style={{ "--i": 2 } as CSSProperties}>
      <SectionTitle
        icon={<Gamepad2 size={18} />}
        title="Kendali"
        hint="Perintah antre sampai alat mengambilnya"
      />

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.45fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Action
              primary
              icon={<UtensilsCrossed size={22} />}
              label="Beri pakan sekarang"
              hint={`Servo terbuka ${settings.durasi_pakan ?? 3} detik`}
              waiting={pendingTypes.has("feed")}
              sending={busy === "feed"}
              // A second feed queued behind a pending one is how a tank gets overfed.
              disabled={busy !== null || pendingTypes.has("feed")}
              onClick={() => void fire("feed", () => sendCommand("feed"))}
            />
          </div>
          <Action
            icon={pumpOn ? <Power size={20} /> : <Droplets size={20} />}
            label={pumpOn ? "Matikan pompa" : "Nyalakan pompa"}
            hint={pumpOn ? "Sedang mengisi air" : `Maks ${settings.durasi_pompa ?? 5} detik`}
            waiting={pendingTypes.has("pump")}
            sending={busy === "pump"}
            disabled={busy !== null}
            onClick={() => void fire("pump", () => sendCommand("pump", { on: !pumpOn }))}
          />
          <Action
            icon={<LockOpen size={20} />}
            label="Buka kunci pompa"
            hint={locked ? "Pompa sedang terkunci" : "Tidak terkunci"}
            waiting={pendingTypes.has("unlock")}
            sending={busy === "unlock"}
            // Unlocking a pump that is not locked only queues a command that does nothing.
            disabled={busy !== null || !locked || pendingTypes.has("unlock")}
            onClick={() => void fire("unlock", () => sendCommand("unlock"))}
          />
        </div>

        {commands[0] ? (
          <Trace command={commands[0]} />
        ) : (
          <p className="flex items-center rounded-2xl border border-dashed border-line-strong px-5 py-4 text-sm text-muted">
            Belum ada perintah dikirim. Statusnya akan muncul di sini langkah demi langkah.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted">
        {offline
          ? "Alat sedang terputus. Perintah kedaluwarsa bila tidak diambil dalam 10 menit, agar tidak berjalan terlambat."
          : "Alat melapor sekitar tiap 5 detik, jadi perintah bisa butuh beberapa detik sebelum dijalankan."}
      </p>
    </section>
  );
}
