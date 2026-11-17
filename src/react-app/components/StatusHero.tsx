import { AlertTriangle, CheckCircle2, CloudOff, Hourglass } from "lucide-react";
import type { Reading } from "../lib/api";
import { Chip, type Tone } from "./ui";

type Props = {
  reading: Reading | null;
  loading: boolean;
  offline: boolean;
  batasAir: number;
  batasPakan: number;
  pending: number;
  now: number;
};

type Verdict = {
  tone: Tone;
  icon: typeof CheckCircle2;
  title: string;
  body: string;
  flags: Array<{ tone: Tone; text: string }>;
};

const date = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function judge({ reading, loading, offline, batasAir, batasPakan, pending }: Props): Verdict {
  if (loading) {
    return { tone: "neutral", icon: Hourglass, title: "Memuat kondisi akuarium", body: "Mengambil pembacaan terakhir dari server.", flags: [] };
  }
  if (reading === null) {
    return {
      tone: "neutral",
      icon: CloudOff,
      title: "Menunggu alat pertama kali melapor",
      body: "Semua tombol tetap bisa ditekan. Perintah akan menunggu sampai alat terhubung.",
      flags: [],
    };
  }

  const flags: Verdict["flags"] = [];
  if (reading.terkunci) flags.push({ tone: "danger", text: "Pompa terkunci" });
  if (reading.level_air !== null && reading.level_air < batasAir) flags.push({ tone: "danger", text: `Air di bawah ${batasAir}%` });
  if (reading.stok_pakan !== null && reading.stok_pakan < batasPakan) flags.push({ tone: "warn", text: `Pakan di bawah ${batasPakan}%` });
  if (pending > 0) flags.push({ tone: "info", text: `${pending} perintah menunggu alat` });

  if (offline) {
    return {
      tone: "danger",
      icon: CloudOff,
      title: "Alat sedang tidak terhubung",
      body: "Angka di bawah adalah pembacaan terakhir yang tersimpan, bukan kondisi saat ini.",
      flags,
    };
  }
  if (reading.terkunci || (reading.level_air !== null && reading.level_air < batasAir)) {
    return {
      tone: "danger",
      icon: AlertTriangle,
      title: reading.terkunci ? "Pompa terkunci, air perlu dicek" : "Air akuarium perlu diisi",
      body: reading.terkunci
        ? "Pompa berhenti sendiri karena air masih rendah. Isi manual lalu buka kuncinya."
        : "Ketinggian air sudah di bawah ambang pompa.",
      flags,
    };
  }
  if (reading.stok_pakan !== null && reading.stok_pakan < batasPakan) {
    return { tone: "warn", icon: AlertTriangle, title: "Stok pakan hampir habis", body: "Isi ulang wadah pakan sebelum jadwal berikutnya.", flags };
  }
  return { tone: "ok", icon: CheckCircle2, title: "Akuarium dalam kondisi baik", body: "Air dan pakan di atas ambang, alat melapor normal.", flags };
}

export function StatusHero(props: Props) {
  const v = judge(props);
  const Icon = v.icon;
  const color = v.tone === "ok" ? "var(--ok)" : v.tone === "danger" ? "var(--danger)" : v.tone === "warn" ? "var(--warn)" : "var(--accent)";

  return (
    <section className="rise flex flex-col gap-6 pt-9 pb-2 lg:flex-row lg:items-end lg:justify-between" style={{ "--i": 0 } as React.CSSProperties}>
      <div className="flex items-start gap-4 sm:gap-5">
        <span
          className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border sm:h-14 sm:w-14"
          style={{
            color,
            borderColor: `color-mix(in oklab, ${color} 35%, transparent)`,
            background: `color-mix(in oklab, ${color} 13%, transparent)`,
            boxShadow: `0 0 36px -8px ${color}`,
          }}
          aria-hidden="true"
        >
          <Icon size={26} strokeWidth={2} />
        </span>
        <div>
          <p className="tnum text-[0.78rem] font-medium text-muted">
            {date.format(new Date(props.now))} · Akuarium 01
          </p>
          <h1 className="mt-1.5 text-[clamp(1.65rem,3.4vw,2.6rem)] font-semibold leading-[1.08] tracking-[-0.025em]">
            {v.title}
          </h1>
          <p className="mt-2 max-w-[56ch] text-[0.95rem] leading-relaxed text-muted">{v.body}</p>
        </div>
      </div>

      {v.flags.length > 0 && (
        <ul className="flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end" aria-label="Hal yang perlu diperhatikan">
          {v.flags.map((f) => (
            <li key={f.text} className="pop">
              <Chip tone={f.tone} dot>
                {f.text}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
