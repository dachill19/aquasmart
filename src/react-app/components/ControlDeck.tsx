import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Check, Droplets, LockOpen, Power, UtensilsCrossed } from "lucide-react";
import { sendCommand, type CommandRow, type Settings } from "../lib/api";
import { COMMAND_LABEL, formatClock } from "../lib/format";
import { CardHead, Spinner } from "./ui";

type Props = {
  device: number;
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
  const status = sending ? "Mengirim…" : waiting ? "Menunggu alat" : hint;
  const busy = sending || waiting;

  return (
    <button
      type="button"
      disabled={disabled}
      data-waiting={busy}
      onClick={onClick}
      className={`btn h-full w-full ${primary ? "btn-primary !justify-between !px-4 !py-3.5" : "!flex-col !items-start !justify-between !gap-3 !px-4 !py-3.5 text-left"}`}
    >
      {primary ? (
        <>
          <span className="flex items-center gap-3.5">
            {icon}
            <span className="text-left">
              <span className="block text-[0.95rem] leading-tight">{label}</span>
              <span className="mt-1 block text-xs font-normal opacity-65">{status}</span>
            </span>
          </span>
          {busy ? <Spinner size={16} /> : <ArrowRight size={17} className="opacity-60" aria-hidden="true" />}
        </>
      ) : (
        <>
          <span className="flex w-full items-center justify-between text-muted">
            {icon}
            {busy && <Spinner />}
          </span>
          <span>
            <span className="block leading-tight">{label}</span>
            <span className="mt-1 block text-xs font-normal text-muted">{status}</span>
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
    <div aria-label="Status perintah terakhir">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Perintah terakhir</p>
        <p className="text-[0.82rem] font-semibold">{COMMAND_LABEL[command.type] ?? command.type}</p>
      </div>

      <ol className="mt-4 grid grid-cols-3">
        {steps.map((s, i) => {
          const done = i < reached;
          const failed = Boolean(command.expired) && i === 1;
          return (
            <li key={s.label} className="relative flex flex-col items-center text-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1/2 top-[9px] h-px w-full -translate-y-1/2 transition-colors duration-500"
                  style={{ background: i < reached ? "var(--accent)" : "var(--line-strong)" }}
                />
              )}
              <span
                className="relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border transition-colors duration-500"
                style={{
                  borderColor: failed ? "var(--danger)" : done ? "var(--accent)" : "var(--line-strong)",
                  background: done && !failed ? "var(--accent)" : "var(--surface)",
                  color: done && !failed ? "var(--bg)" : "var(--accent)",
                }}
              >
                {done && !failed && <Check size={10} strokeWidth={3.6} />}
                {failed && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
                {!done && !failed && i === reached && !command.expired && <Spinner size={9} />}
              </span>
              <span className={`mt-2 text-xs font-medium ${done ? "text-fg" : "text-faint"}`}>{failed ? "Kedaluwarsa" : s.label}</span>
              <span className="tnum mt-0.5 font-mono text-[0.68rem] text-muted">{s.at ? formatClock(s.at) : "—"}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ControlDeck({ device, settings, pumpOn, locked, offline, commands, pendingTypes, onSent }: Props) {
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
    <section className="card rise @container flex h-full flex-col p-5" style={{ "--i": 2 } as CSSProperties}>
      <CardHead title="Kendali" meta="perintah antre sampai alat mengambilnya" />

      <div className="mt-4 grid gap-5 @[44rem]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] @[44rem]:gap-8">
        <div className="grid grid-cols-2 gap-2.5 @[44rem]:grid-cols-[1.45fr_1fr_1fr]">
          <div className="col-span-2 @[44rem]:col-span-1">
            <Action
              primary
              icon={<UtensilsCrossed size={20} />}
              label="Beri pakan sekarang"
              hint={`servo terbuka ${settings.durasi_pakan ?? 3} detik`}
              waiting={pendingTypes.has("feed")}
              sending={busy === "feed"}
              // A second feed queued behind a pending one is how a tank gets overfed.
              disabled={busy !== null || pendingTypes.has("feed")}
              onClick={() => void fire("feed", () => sendCommand(device, "feed"))}
            />
          </div>
          <Action
            icon={pumpOn ? <Power size={18} /> : <Droplets size={18} />}
            label={pumpOn ? "Matikan pompa" : "Nyalakan pompa"}
            hint={pumpOn ? "sedang mengisi air" : `maks ${settings.durasi_pompa ?? 5} detik`}
            waiting={pendingTypes.has("pump")}
            sending={busy === "pump"}
            disabled={busy !== null}
            onClick={() => void fire("pump", () => sendCommand(device, "pump", { on: !pumpOn }))}
          />
          <Action
            icon={<LockOpen size={18} />}
            label="Buka kunci pompa"
            hint={locked ? "pompa terkunci" : "tidak terkunci"}
            waiting={pendingTypes.has("unlock")}
            sending={busy === "unlock"}
            // Unlocking a pump that is not locked only queues a command that does nothing.
            disabled={busy !== null || !locked || pendingTypes.has("unlock")}
            onClick={() => void fire("unlock", () => sendCommand(device, "unlock"))}
          />
        </div>

        <div className="border-t border-line pt-4 @[44rem]:border-t-0 @[44rem]:pt-0">
          {commands[0] ? (
            <Trace command={commands[0]} />
          ) : (
            <p className="text-sm leading-relaxed text-muted">Belum ada perintah dikirim. Statusnya muncul di sini langkah demi langkah.</p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <p className="mt-auto pt-4 text-xs leading-relaxed text-muted">
        {offline
          ? "Alat sedang terputus. Perintah kedaluwarsa bila tidak diambil dalam 10 menit, agar tidak berjalan terlambat."
          : "Alat melapor sekitar tiap 5 detik, jadi perintah bisa butuh beberapa detik sebelum dijalankan."}
      </p>
    </section>
  );
}
