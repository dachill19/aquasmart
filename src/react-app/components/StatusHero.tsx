import type { CSSProperties } from "react";
import type { Reading } from "../lib/api";
import { Tag, type Tone } from "./ui";

type Props = {
  reading: Reading | null;
  loading: boolean;
  offline: boolean;
  batasAir: number;
  batasPakan: number;
  pending: number;
  now: number;
  /** The selected aquarium, so the verdict is never read as another tank's. */
  name: string;
  simulated: boolean;
};

type Verdict = {
  tone: Tone;
  title: string;
  body: string;
  flags: Array<{ tone: Tone; text: string }>;
};

const date = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function judge({ reading, loading, offline, batasAir, batasPakan, pending }: Props): Verdict {
  if (loading) {
    return { tone: "neutral", title: "Memuat kondisi akuarium", body: "Mengambil pembacaan terakhir dari server.", flags: [] };
  }
  if (reading === null) {
    return {
      tone: "neutral",
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
      title: "Alat sedang tidak terhubung",
      body: "Angka di bawah adalah pembacaan terakhir yang tersimpan, bukan kondisi saat ini.",
      flags,
    };
  }
  if (reading.terkunci || (reading.level_air !== null && reading.level_air < batasAir)) {
    return {
      tone: "danger",
      title: reading.terkunci ? "Pompa terkunci, air perlu dicek" : "Air akuarium perlu diisi",
      body: reading.terkunci
        ? "Pompa berhenti sendiri karena air masih rendah. Isi manual lalu buka kuncinya."
        : "Ketinggian air sudah di bawah ambang pompa.",
      flags,
    };
  }
  if (reading.stok_pakan !== null && reading.stok_pakan < batasPakan) {
    return { tone: "warn", title: "Stok pakan hampir habis", body: "Isi ulang wadah pakan sebelum jadwal berikutnya.", flags };
  }
  return { tone: "ok", title: "Akuarium dalam kondisi baik", body: "Air dan pakan di atas ambang, alat melapor normal.", flags };
}

export function StatusHero(props: Props) {
  const v = judge(props);
  const color = v.tone === "ok" ? "var(--ok)" : v.tone === "danger" ? "var(--danger)" : v.tone === "warn" ? "var(--warn)" : "var(--faint)";

  return (
    <section
      className="rise flex flex-col gap-4 pb-1 pt-7 lg:flex-row lg:items-end lg:justify-between"
      style={{ "--i": 0 } as CSSProperties}
    >
      <div>
        <p className="tnum flex items-center gap-2.5 text-[0.8rem] text-muted">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color }} />
          {date.format(new Date(props.now))} · {props.name}
          {props.simulated && <Tag>Simulasi</Tag>}
        </p>
        <h1 className="mt-2 text-[clamp(1.7rem,3vw,2.4rem)] font-semibold leading-[1.1] tracking-[-0.03em]">{v.title}</h1>
        <p className="mt-2 max-w-[62ch] text-[0.92rem] leading-relaxed text-muted">{v.body}</p>
      </div>

      {v.flags.length > 0 && (
        <ul className="flex flex-wrap gap-2 lg:max-w-[440px] lg:justify-end" aria-label="Hal yang perlu diperhatikan">
          {v.flags.map((f) => (
            <li key={f.text} className="pop">
              <Tag tone={f.tone} dot>
                {f.text}
              </Tag>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
