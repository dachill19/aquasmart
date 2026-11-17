/*
  AQUASMART - akuarium pintar berbasis IoT
  NodeMCU ESP8266 + HC-SR04 + sensor level air + RTC DS1302 + servo SG90 + relay pompa

  Blynk sudah dilepas sepenuhnya. Alat sekarang berbicara ke server sendiri:
  satu HTTPS POST tiap siklus mengirim telemetri dan langsung menerima perintah
  yang menunggu di balasannya. TLS di ESP8266 mahal, jadi satu sambungan per
  siklus jauh lebih hemat daripada kirim lalu tanya terpisah.

  Pemetaan pin tidak diubah dari versi yang sudah terbukti jalan di alat.
  Kalibrasi sensor sekarang disimpan di server dan dikirim tiap siklus, jadi
  menyetel ulang tidak menuntut flash ulang. Otomasi pompa menuntut jumlah
  pembacaan berturut-turut yang sama untuk menyala maupun untuk berhenti.
*/

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <Servo.h>
#include <ThreeWire.h>
#include <RtcDS1302.h>

#include "secrets.h"   // WIFI_SSID, WIFI_PASS, SERVER_HOST, DEVICE_KEY

// ==========================================
// PEMETAAN PIN (TIDAK DIUBAH)
// ==========================================
const int RELAY_PIN    = 5;   // GPIO 5  (D1) -> IN Relay Pompa Air
const int WATER_POWER  = 16;  // GPIO 16 (D0) -> VCC Sensor Water Level
const int WATER_ANALOG = A0;  // ADC0 (A0) -> Sinyal Analog Sensor Air

const int TRIG_PIN     = 14;  // GPIO 14 (D5) -> TRIG HC-SR04
const int ECHO_PIN     = 12;  // GPIO 12 (D6) -> ECHO HC-SR04
const int SERVO_PIN    = 13;  // GPIO 13 (D7) -> Signal Servo SG90

const int RTC_DAT_PIN  = 0;   // GPIO 0  (D3) -> DAT
const int RTC_CLK_PIN  = 4;   // GPIO 4  (D2) -> CLK
const int RTC_RST_PIN  = 15;  // GPIO 15 (D8) -> RST

const bool RELAY_ACTIVE_LOW = true;

ThreeWire myWire(RTC_DAT_PIN, RTC_CLK_PIN, RTC_RST_PIN);
RtcDS1302<ThreeWire> Rtc(myWire);
Servo servoPakan;

// ==========================================
// KALIBRASI
// Nilai di bawah hanya titik awal. Server yang memegang angka sebenarnya dan
// mengirimkannya setiap siklus, jadi menyetel ulang kalibrasi tidak lagi
// menuntut flash ulang.
// ==========================================
int airKering     = 10;   // ADC saat sensor kering (terukur 3-10 pada alat ini)
int airBasah      = 210;  // ADC saat air di tinggi aman tertinggi, yaitu sedikit di
                          // bawah kabel sensor yang tidak terlindungi. Di ketinggian
                          // itu strip berayun 187-235, jadi 210 adalah nilai tipikal
                          // dan bukan puncaknya: memasang terlalu tinggi membuat pompa
                          // terus mengisi melewati kabel, memasang terlalu rendah
                          // hanya membuatnya berhenti lebih awal.
int pakanPenuhMm  = 35;   // jarak sensor ke permukaan pakan saat wadah penuh
int pakanKosongMm = 82;   // jarak sensor ke dasar wadah lurus saat kosong

// Wadah pakan berbentuk kerucut, jadi sebagian gema datang dari dinding miring
// dan bukan dari permukaan pelet. Satu ping tunggal pernah menghasilkan 0,07 cm
// lalu 87 cm pada wadah yang sama sekali tidak bergerak, sehingga pembacaan
// mentah tidak bisa dipakai apa adanya.
const int   SAMPEL_PAKAN     = 5;
const float JARAK_MIN_CM     = 2.0f;    // HC-SR04 buta di bawah jarak ini
const float JARAK_MAKS_CM    = 100.0f;
const float BOBOT_EMA        = 0.4f;    // perataan antar siklus; 1.0 = tanpa perataan
const int   HISTERESIS_PAKAN = 8;       // selisih % sebelum peringatan boleh berbunyi lagi

// ==========================================
// SETELAN - nilai awal, nanti ditimpa server
// Server yang menyimpannya, jadi reboot tidak lagi menghapus perubahan.
// ==========================================
int batasAir      = 30;   // di bawah ini pompa menyala
int targetAir     = 80;   // sampai di sini pompa mengisi, lalu berhenti
int batasPakan    = 30;
int durasiBukaDetik = 3;
int durasiPompaDetik = 10;
int jamPagi = 7, menitPagi = 0;
int jamSore = 17, menitSore = 0;

const unsigned long COOLDOWN_POMPA = 30000UL;
const int KONFIRMASI_MULAI = 3;

// Pengaman luapan. Di atas angka ini pompa dihentikan dan perintah manual
// ditolak, apa pun sumbernya. Kalibrasi sudah menetapkan 100% sebagai tinggi
// air tertinggi yang masih aman, jadi angka ini menyisakan sedikit margin di
// bawahnya. Berbeda dari ambang biasa, pengaman ini tidak menunggu konfirmasi:
// berhenti sekali terlalu cepat tidak merugikan siapa pun, sedangkan terlambat
// berhenti berarti air membasahi header sensor dan kabelnya.
const int BATAS_LUAP = 95;

// ==========================================
// STATUS
// ==========================================
bool pompaNyala = false;
bool pompaTerkunci = false;
bool pompaManual = false;        // true = pompa dinyalakan dari dashboard
bool notifPompaTerkirim = false;
bool notifPakanTerkirim = false;
bool pernahMati = false;
unsigned long waktuMulaiPompa = 0;
unsigned long waktuPompaMati = 0;
int jumlahBacaanRendah = 0;
int jumlahBacaanAman = 0;   // pasangan simetris: butuh konfirmasi juga untuk berhenti
// Keputusan kunci ditunda sampai pembacaan pertama setelah pompa mati. Selama
// pompa berputar ADC melonjak (terukur 12 -> ~36%), jadi pembacaan terakhir
// saat pompa jalan tidak bisa dipakai: dulu itulah sebabnya pompa kadang
// terkunci dan kadang tidak untuk keadaan air yang sama.
bool cekKunciSetelahPompa = false;

const unsigned long INTERVAL_AIR_NORMAL = 10000UL;
const unsigned long INTERVAL_AIR_POMPA  = 500UL;
// Dinaikkan dari 200 ms saat menelusuri pembacaan ADC ~100 pada tangki kosong.
// Ternyata bukan itu sebabnya: lonjakannya bertahan di 500 ms dan selalu
// bertepatan dengan pompa yang sedang berputar, bukan dengan waktu settle.
// Angka ini dibiarkan 500 ms karena memberi margin dan tidak ada ruginya.
const unsigned long WAKTU_STABIL_AIR    = 500UL;
const int JUMLAH_SAMPEL = 10;

bool sensorAirAktif = false;
bool pengukuranPertama = true;
unsigned long waktuSensorAktif = 0;
unsigned long waktuPengukuranTerakhir = 0;

int rawWater = 0;
int levelAir = -1;              // -1 = belum ada pembacaan sah

unsigned long waktuBacaPakan = 0;
const unsigned long INTERVAL_PAKAN = 2000UL;
float jarakPakan = -1;          // -1 = tidak terbaca
int stokPakan = -1;

bool sedangMemberiPakan = false;
unsigned long waktuMulaiPakan = 0;
String metodePakan = "";
String jadwalTerakhir = "";
unsigned long waktuCekRTC = 0;

// ==========================================
// ANTREAN KEJADIAN DAN PENGESAHAN PERINTAH
// ==========================================
// Sama dengan batas yang dipotong server, supaya tidak ada kejadian yang
// hilang diam-diam di salah satu sisi.
const int MAKS_EVENT = 5;
String eventKind[MAKS_EVENT];
String eventPesan[MAKS_EVENT];
String eventId[MAKS_EVENT];
int jumlahEvent = 0;

// Pengiriman di sini bersifat "setidaknya sekali": kalau POST sampai ke server
// tetapi balasannya hilang, alat mengira gagal dan mengirim ulang antreannya.
// Tanpa identitas, server menyimpan kejadian yang sama berkali-kali; satu
// peringatan pakan pernah tercatat 60 kali dengan cara ini. Penanda boot acak
// membuat id tetap unik walau pencacahnya kembali nol setiap kali alat menyala.
uint32_t penandaBoot = 0;
uint32_t nomorEvent = 0;

// HARUS sama dengan LIMIT pada kueri perintah tertunda di server (saat ini 10).
// Kalau antrean ini lebih kecil, perintah yang ke-9 dan seterusnya tidak pernah
// disahkan, jadi server menawarkannya lagi tiap siklus dan alat menjalankannya
// berulang-ulang.
const int MAKS_ACK = 10;
long ackIds[MAKS_ACK];
int jumlahAck = 0;

void catatEvent(const String &kind, const String &pesan) {
  if (jumlahEvent >= MAKS_EVENT) return;
  eventKind[jumlahEvent] = kind;
  eventPesan[jumlahEvent] = pesan;
  eventId[jumlahEvent] = String(penandaBoot, HEX) + "-" + String(++nomorEvent);
  jumlahEvent++;
  Serial.println("[EVENT] " + kind + ": " + pesan);
}

void catatAck(long id) {
  if (jumlahAck >= MAKS_ACK) return;
  for (int i = 0; i < jumlahAck; i++) if (ackIds[i] == id) return;
  ackIds[jumlahAck++] = id;
}

// ==========================================
// RELAY DAN POMPA
// ==========================================
void relayAktif(bool nyala) {
  if (RELAY_ACTIVE_LOW) {
    if (nyala) {
      pinMode(RELAY_PIN, OUTPUT);
      digitalWrite(RELAY_PIN, LOW);
    } else {
      pinMode(RELAY_PIN, INPUT);   // dibiarkan ditarik pull-up modul
    }
  } else {
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, nyala ? HIGH : LOW);
  }
}

void setPompa(bool nyala, bool manual) {
  pompaNyala = nyala;
  pompaManual = nyala ? manual : false;
  relayAktif(nyala);

  if (nyala) {
    waktuMulaiPompa = millis();
    cekKunciSetelahPompa = false;   // putaran baru membatalkan pemeriksaan lama
  } else {
    waktuPompaMati = millis();
    pernahMati = true;
  }
  Serial.println(nyala ? "[POMPA] NYALA" : "[POMPA] MATI");
}

// ==========================================
// PAKAN
// ==========================================
// Posisi servo dalam mikrodetik lebar pulsa, bukan derajat, supaya posisi tutup
// bisa digeser melewati batas 0 derajat. Dulu 0 derajat = 1000 us dan 90 derajat
// = 1500 us; 1 derajat kira-kira 5,6 us. Tanduk servo dipasang supaya wadah
// tertutup tepat di 1000 us.
const int SERVO_TUTUP = 1000;
const int SERVO_BUKA  = 1500;
const int SERVO_MIN_US = 500;    // batas pengaman library, bukan posisi
const int SERVO_MAX_US = 2500;

// Servo ES08A diberi daya dari VIN, yang tegangannya sudah di bawah batas
// servo itu. Lompatan langsung ke posisi tujuan menarik arus lonjakan yang
// menjatuhkan VIN, dan servo lalu berayun liar sebelum diam. Bergerak ~2 derajat
// tiap 15 ms (tutup -> buka sekitar 0,7 detik) menjaga arusnya tetap kecil.
const int LANGKAH_SERVO = 11;    // us per langkah
const unsigned long JEDA_LANGKAH_SERVO = 15UL;

int posisiServo = SERVO_TUTUP;   // posisi terakhir yang dikirim ke servo
int targetServo = SERVO_TUTUP;
unsigned long waktuServoGerak = 0;

void gerakkanServo(int posisi) {
  targetServo = posisi;
}

// Selama ini true, pompa tidak boleh mulai: servo sedang memberi pakan atau
// masih dalam perjalanan menutup.
bool servoSibuk() {
  return sedangMemberiPakan || posisiServo != targetServo;
}

// Dipanggil tiap putaran loop. Servo juga hanya diberi pulsa saat bergerak:
// pulsa yang terus dikirim selagi diam ikut terganggu WiFi dan derau catu, dan
// ES08A mengikutinya. Tanpa pulsa servo diam, ditahan gesekan roda giginya.
void jalankanServo() {
  if (posisiServo != targetServo) {
    if (millis() - waktuServoGerak < JEDA_LANGKAH_SERVO) return;
    posisiServo += constrain(targetServo - posisiServo, -LANGKAH_SERVO, LANGKAH_SERVO);
    if (servoPakan.attached()) {
      servoPakan.write(posisiServo);
    } else {
      servoPakan.attach(SERVO_PIN, SERVO_MIN_US, SERVO_MAX_US, posisiServo);
    }
    waktuServoGerak = millis();
    return;
  }
  // Selama wadah terbuka servo tetap ditahan; selain itu dilepas begitu sampai.
  if (!sedangMemberiPakan && servoPakan.attached() && millis() - waktuServoGerak >= 500UL) {
    servoPakan.detach();
  }
}

void beriPakan(const String &metode) {
  if (sedangMemberiPakan) {
    Serial.println("Pemberian pakan masih berlangsung.");
    return;
  }
  sedangMemberiPakan = true;
  metodePakan = metode;
  waktuMulaiPakan = millis();
  Serial.println("Memberi pakan: " + metode);
}

void prosesPakan() {
  if (!sedangMemberiPakan) return;

  // Servo dan pompa sama-sama menarik arus dari VIN, jadi tidak boleh jalan
  // bersamaan: pakan menunggu pompa mati dulu.
  if (pompaNyala) {
    waktuMulaiPakan = millis();
    return;
  }
  gerakkanServo(SERVO_BUKA);

  // Durasi dihitung sejak wadah terbuka penuh, supaya jumlah pakan tidak
  // berkurang karena servo kini membuka perlahan.
  if (posisiServo != SERVO_BUKA) {
    waktuMulaiPakan = millis();
    return;
  }
  if (millis() - waktuMulaiPakan >= (unsigned long)durasiBukaDetik * 1000UL) {
    gerakkanServo(SERVO_TUTUP);
    sedangMemberiPakan = false;
    catatEvent("feed_done", "Ikan telah diberi pakan (" + metodePakan + ")");
  }
}

// ==========================================
// SENSOR AIR + OTOMASI POMPA
// ==========================================
void monitoringAir() {
  unsigned long sekarang = millis();
  unsigned long intervalAir = pompaNyala ? INTERVAL_AIR_POMPA : INTERVAL_AIR_NORMAL;

  if (!sensorAirAktif &&
      (pengukuranPertama || sekarang - waktuPengukuranTerakhir >= intervalAir)) {
    digitalWrite(WATER_POWER, HIGH);
    sensorAirAktif = true;
    waktuSensorAktif = sekarang;
    pengukuranPertama = false;
  }

  if (sensorAirAktif && sekarang - waktuSensorAktif >= WAKTU_STABIL_AIR) {
    long total = 0;
    for (int i = 0; i < JUMLAH_SAMPEL; i++) {
      total += analogRead(WATER_ANALOG);
      delay(2);
    }
    rawWater = total / JUMLAH_SAMPEL;

    // Skala terbalik berarti kalibrasi belum masuk akal. Lebih baik mengaku
    // tidak tahu daripada memompa berdasarkan angka karangan.
    levelAir = (airBasah > airKering)
                 ? constrain(map(rawWater, airKering, airBasah, 0, 100), 0, 100)
                 : -1;

    digitalWrite(WATER_POWER, LOW);
    sensorAirAktif = false;
    waktuPengukuranTerakhir = millis();

    Serial.print("Raw Water: "); Serial.print(rawWater);
    Serial.print(" | Level: "); Serial.print(levelAir); Serial.println("%");

    // Pengaman luapan didahulukan dan tidak mempedulikan pompaManual: inilah
    // satu-satunya penghenti yang juga berlaku untuk perintah dari dashboard.
    if (pompaNyala && levelAir >= BATAS_LUAP) {
      setPompa(false, false);
      catatEvent("critical_water",
                 "Pompa dihentikan oleh pengaman: air sudah " + String(levelAir) + "%.");
      Serial.println("-> PENGAMAN LUAPAN: pompa MATI.");
    }

    if (levelAir < 0) {
      // Tanpa pembacaan sah, otomasi dihentikan. Pompa manual dari dashboard
      // tetap boleh jalan karena di situ ada manusia yang melihat airnya.
      if (pompaNyala && !pompaManual) {
        setPompa(false, false);
        Serial.println("-> Kalibrasi air tidak sah. Pompa otomatis MATI.");
      }
      jumlahBacaanRendah = 0;
      jumlahBacaanAman = 0;
    } else {
      // Ambang nyala dan target isi adalah dua angka berbeda. Dulu keduanya
      // memakai batasAir, sehingga pompa berhenti tepat saat air melewati
      // garis yang menyalakannya: tangki tidak pernah terisi, hanya didorong
      // balik melewati garis lalu turun lagi.
      // Sensor harus sudah dinyalakan setelah pompa mati, supaya tidak ada
      // sampel yang diambil selagi motor masih berputar.
      if (cekKunciSetelahPompa && !pompaNyala &&
          (long)(waktuSensorAktif - waktuPompaMati) >= 0) {
        cekKunciSetelahPompa = false;
        if (levelAir < batasAir) {
          pompaTerkunci = true;
          jumlahBacaanRendah = 0;
          if (!notifPompaTerkirim) {
            catatEvent("critical_water",
                       "Air masih " + String(levelAir) + "% setelah pompa menyala " +
                       String(durasiPompaDetik) + " detik. Pompa dikunci.");
            notifPompaTerkirim = true;
          }
          Serial.println("-> Air tidak naik setelah pompa. Pompa TERKUNCI.");
        }
      }

      if (levelAir >= batasAir) {
        jumlahBacaanRendah = 0;
        pompaTerkunci = false;
        notifPompaTerkirim = false;
      } else if (!pompaTerkunci && !pompaNyala) {
        jumlahBacaanRendah++;
        bool cooldownSelesai = !pernahMati || (millis() - waktuPompaMati >= COOLDOWN_POMPA);
        // Pompa menunggu servo selesai, supaya keduanya tidak menarik arus bersamaan.
        if (jumlahBacaanRendah >= KONFIRMASI_MULAI && cooldownSelesai && !servoSibuk()) {
          jumlahBacaanRendah = 0;
          jumlahBacaanAman = 0;
          setPompa(true, false);
          Serial.println("-> Air rendah terkonfirmasi. Pompa NYALA otomatis.");
        }
      }

      // Pengisian berhenti di target, dan menuntut konfirmasi sebanyak yang
      // dituntut untuk menyala. Pada alat ini ADC melonjak selama pompa
      // berputar, dan satu lonjakan pernah menghentikan pompa setengah detik
      // setelah menyala.
      if (pompaNyala && !pompaManual) {
        if (levelAir >= targetAir) {
          jumlahBacaanAman++;
          if (jumlahBacaanAman >= KONFIRMASI_MULAI) {
            setPompa(false, false);
            Serial.println("-> Target isi tercapai (terkonfirmasi). Pompa MATI.");
          } else {
            Serial.print("-> Pembacaan di target ke-");
            Serial.print(jumlahBacaanAman);
            Serial.println(", menunggu konfirmasi.");
          }
        } else {
          jumlahBacaanAman = 0;
        }
      }
    }
  }
}

// Batas waktu pompa berlaku untuk pompa otomatis maupun manual, supaya perintah
// dari dashboard tidak bisa membanjiri akuarium.
void kontrolPompa() {
  if (!pompaNyala) return;
  if (millis() - waktuMulaiPompa < (unsigned long)durasiPompaDetik * 1000UL) return;

  bool tadiManual = pompaManual;
  setPompa(false, false);

  // Kunci diputuskan di monitoringAir dari pembacaan bersih berikutnya.
  if (!tadiManual) cekKunciSetelahPompa = true;
}

// ==========================================
// SENSOR PAKAN
// ==========================================

// Satu ping. Mengembalikan -1 untuk gema yang hilang maupun yang mustahil,
// karena keduanya sama-sama tidak boleh ikut dihitung.
float pingSekali() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000UL);
  if (duration == 0) return -1.0f;

  float cm = duration * 0.0343f / 2.0f;
  if (cm < JARAK_MIN_CM || cm > JARAK_MAKS_CM) return -1.0f;
  return cm;
}

// Median, bukan rata-rata: satu pantulan dinding sebesar 87 cm cukup untuk
// menyeret rata-rata, sedangkan median mengabaikannya.
float pingMedian() {
  float v[SAMPEL_PAKAN];
  int n = 0;
  for (int i = 0; i < SAMPEL_PAKAN; i++) {
    float cm = pingSekali();
    if (cm > 0) v[n++] = cm;
    delay(60);                      // HC-SR04 butuh jeda agar gema sebelumnya habis
  }
  if (n == 0) return -1.0f;

  for (int i = 1; i < n; i++) {     // insertion sort, n maksimal 5
    float kunci = v[i];
    int j = i - 1;
    while (j >= 0 && v[j] > kunci) { v[j + 1] = v[j]; j--; }
    v[j + 1] = kunci;
  }
  return v[n / 2];
}

void monitoringPakan() {
  if (millis() - waktuBacaPakan < INTERVAL_PAKAN) return;

  // Selama servo terbuka, pelet berjatuhan melewati berkas sensor, jadi apa pun
  // yang terbaca bukan tinggi permukaan.
  if (sedangMemberiPakan) return;

  // Burst lima ping memblokir sekitar 300 ms. Batas waktu pompa lebih berhak
  // atas waktu itu, dan tinggi pakan toh tidak berubah selagi pompa jalan.
  if (pompaNyala) return;

  waktuBacaPakan = millis();

  float m = pingMedian();
  if (m < 0) {
    // Mengaku tidak terbaca. Menahan angka lama membuat dashboard menampilkan
    // nilai basi tanpa cara untuk tahu.
    jarakPakan = -1;
    stokPakan = -1;
    return;
  }

  jarakPakan = (jarakPakan > 0) ? (BOBOT_EMA * m + (1.0f - BOBOT_EMA) * jarakPakan) : m;

  float penuh  = pakanPenuhMm / 10.0f;
  float kosong = pakanKosongMm / 10.0f;
  if (kosong <= penuh) {            // kalibrasi terbalik; jangan mengarang angka
    stokPakan = -1;
    return;
  }
  stokPakan = constrain((int)(((kosong - jarakPakan) / (kosong - penuh)) * 100.0f), 0, 100);

  // Ambang turun dan ambang naik sengaja dipisah. Tanpa itu, gauge yang
  // bergetar di sekitar batas mengirim peringatan berulang-ulang; pada uji
  // semalam peringatan pakan terkirim 50 kali.
  if (stokPakan < batasPakan) {
    if (!notifPakanTerkirim) {
      catatEvent("critical_food",
                 "Peringatan: stok pakan ikan kurang dari " + String(batasPakan) + "%.");
      notifPakanTerkirim = true;
    }
  } else if (stokPakan >= batasPakan + HISTERESIS_PAKAN) {
    notifPakanTerkirim = false;
  }
}

// ==========================================
// JADWAL RTC
// ==========================================

// Selisih detik antara epoch Unix (1970) dan epoch RtcDateTime (2000).
const uint32_t EPOCH_2000 = 946684800UL;

// IsDateTimeValid() hanya memeriksa bendera berhenti pada DS1302, bukan masuk
// akal tidaknya tanggal. Alat ini pernah boot dengan jam menunjuk tahun 2042
// dan dianggap sah, jadi tahunnya diperiksa sendiri.
bool jamMasukAkal() {
  RtcDateTime t = Rtc.GetDateTime();
  return t.IsValid() && t.Year() >= 2025 && t.Year() <= 2035;
}
void selaraskanJam(uint32_t epochWib) {
  if (epochWib < EPOCH_2000) return;          // balasan tanpa waktu; abaikan
  RtcDateTime seharusnya(epochWib - EPOCH_2000);

  long selisih = (long)seharusnya.TotalSeconds() - (long)Rtc.GetDateTime().TotalSeconds();
  if (selisih > -30 && selisih < 30) return;  // hanyut wajar, biarkan

  Rtc.SetDateTime(seharusnya);
  char penanda[32];
  snprintf(penanda, sizeof(penanda), "%04u-%02u-%02u %02u:%02u:%02u",
           seharusnya.Year(), seharusnya.Month(), seharusnya.Day(),
           seharusnya.Hour(), seharusnya.Minute(), seharusnya.Second());
  Serial.print("[RTC] diselaraskan dari server ke ");
  Serial.print(penanda);
  Serial.print(" (selisih ");
  Serial.print(selisih);
  Serial.println(" detik)");
}

void cekJadwalRTC() {
  if (millis() - waktuCekRTC < 1000UL) return;
  waktuCekRTC = millis();

  // Memberi pakan menurut jam yang salah lebih berbahaya daripada tidak
  // memberi pakan sama sekali: ikan mati karena kelebihan pakan, bukan karena
  // satu jadwal terlewat. Jadwal otomatis menunggu sampai jamnya tepercaya;
  // tombol beri pakan di dashboard tetap jalan.
  if (!jamMasukAkal()) return;

  RtcDateTime now = Rtc.GetDateTime();
  if (!now.IsValid()) return;

  int jam = now.Hour(), menit = now.Minute();
  bool cocokPagi = (jam == jamPagi && menit == menitPagi);
  bool cocokSore = (jam == jamSore && menit == menitSore);
  if (!cocokPagi && !cocokSore) return;

  String kunci = String(now.Year()) + "-" + String(now.Month()) + "-" + String(now.Day()) +
                 "-" + String(jam) + "-" + String(menit);
  if (kunci == jadwalTerakhir) return;
  jadwalTerakhir = kunci;

  beriPakan(cocokPagi ? "Otomatis Pagi" : "Otomatis Sore");
}

// ==========================================
// PERINTAH DARI SERVER
// ==========================================
void jalankanPerintah(JsonObjectConst cmd) {
  long id = cmd["id"] | -1L;
  const char *type = cmd["type"] | "";

  if (strcmp(type, "feed") == 0) {
    beriPakan("Manual dashboard");
  } else if (strcmp(type, "pump") == 0) {
    bool on = cmd["payload"]["on"] | false;
    if (on && levelAir >= BATAS_LUAP) {
      // Perintah tetap disahkan di bawah supaya server tidak menawarkannya
      // lagi; penolakannya muncul di tabel Catatan agar terlihat operator.
      catatEvent("critical_water",
                 "Perintah pompa ditolak: air sudah " + String(levelAir) + "%.");
      Serial.println("[POMPA] perintah ditolak, air sudah penuh.");
    } else if (on && servoSibuk()) {
      catatEvent("info", "Perintah pompa ditolak: servo sedang memberi pakan. Coba lagi sebentar.");
      Serial.println("[POMPA] perintah ditolak, servo sedang bergerak.");
    } else if (on) {
      pompaTerkunci = false;          // perintah manual membatalkan kunci
      setPompa(true, true);
    } else {
      setPompa(false, false);
    }
  } else if (strcmp(type, "unlock") == 0) {
    pompaTerkunci = false;
    notifPompaTerkirim = false;
    jumlahBacaanRendah = 0;
    Serial.println("[POMPA] Kunci dibuka dari dashboard.");
  } else if (strcmp(type, "settings") == 0) {
    // Setelan juga datang lewat objek settings di tiap balasan; blok ini hanya
    // memastikan perintah eksplisit ikut disahkan.
    Serial.println("[SETELAN] perintah diterima");
  }

  if (id >= 0) catatAck(id);
}

void terapkanSetelan(JsonObjectConst s) {
  if (s.isNull()) return;
  batasAir         = s["batas_air"]    | batasAir;
  targetAir        = s["target_air"]   | targetAir;
  batasPakan       = s["batas_pakan"]  | batasPakan;
  durasiBukaDetik  = s["durasi_pakan"] | durasiBukaDetik;
  durasiPompaDetik = s["durasi_pompa"] | durasiPompaDetik;
  jamPagi          = s["jam_pagi"]     | jamPagi;
  menitPagi        = s["menit_pagi"]   | menitPagi;
  jamSore          = s["jam_sore"]     | jamSore;
  menitSore        = s["menit_sore"]   | menitSore;

  // Kalibrasi ikut datang dari server, jadi menyetel ulang cukup lewat dashboard.
  airKering        = s["air_kering"]      | airKering;
  airBasah         = s["air_basah"]       | airBasah;
  pakanPenuhMm     = s["pakan_penuh_mm"]  | pakanPenuhMm;
  pakanKosongMm    = s["pakan_kosong_mm"] | pakanKosongMm;
}

// ==========================================
// TELEMETRI
// ==========================================
const unsigned long INTERVAL_KIRIM = 5000UL;
unsigned long waktuKirimTerakhir = 0;
bool pernahTerkirim = false;

void kirimTelemetri() {
  if (WiFi.status() != WL_CONNECTED) return;

  JsonDocument body;
  // Pembacaan yang gagal dikirim sebagai null, bukan sebagai nol. Nol adalah
  // klaim bahwa wadahnya kosong, dan itu belum tentu benar.
  if (levelAir >= 0) body["level_air"] = levelAir; else body["level_air"] = nullptr;
  body["raw_water"] = rawWater;
  if (stokPakan >= 0) body["stok_pakan"] = stokPakan; else body["stok_pakan"] = nullptr;
  if (jarakPakan > 0) body["jarak_pakan"] = jarakPakan; else body["jarak_pakan"] = nullptr;
  body["pompa"]        = pompaNyala ? 1 : 0;
  body["terkunci"]     = pompaTerkunci ? 1 : 0;
  body["status_air"]   = levelAir < 0 ? "Tidak terbaca" : (levelAir < batasAir ? "Kritis" : "Aman");
  body["status_pakan"] = stokPakan < 0 ? "Tidak terbaca" : (stokPakan < batasPakan ? "Kritis" : "Aman");
  body["rssi"]         = WiFi.RSSI();
  body["uptime_ms"]    = millis();

  if (jumlahEvent > 0) {
    JsonArray ev = body["events"].to<JsonArray>();
    for (int i = 0; i < jumlahEvent; i++) {
      JsonObject o = ev.add<JsonObject>();
      o["id"] = eventId[i];
      o["kind"] = eventKind[i];
      o["message"] = eventPesan[i];
    }
  }
  if (jumlahAck > 0) {
    JsonArray ac = body["ack"].to<JsonArray>();
    for (int i = 0; i < jumlahAck; i++) ac.add(ackIds[i]);
  }

  String payload;
  serializeJson(body, payload);

  WiFiClientSecure client;
  // Sertifikat sengaja tidak diperiksa. Sudah dicoba: daftar akar CA memakan
  // heap yang dibutuhkan buffer TLS 16 KB, dan pemeriksaannya butuh jam,
  // padahal DS1302 terbaca meleset bertahun-tahun saat pompa berputar, sehingga
  // alat bisa terkunci offline. Risiko yang tersisa hanya pembacaan palsu dari
  // orang di WiFi yang sama; kendali alat memang terbuka lewat dashboard.
  client.setInsecure();

  // Buffer terima harus memuat satu rekaman TLS utuh. Angka 512 hanya aman bila
  // server mau menegosiasikan fragmen kecil, dan Cloudflare tidak mau, sehingga
  // POST sering putus dengan kode -5. Buffer kirim tetap kecil karena permintaan
  // kita memang pendek.
  client.setBufferSizes(16384, 512);

  HTTPClient http;
  http.setTimeout(6000);                // batasi agar kontrol pompa tidak tertahan lama
  String url = String("https://") + SERVER_HOST + "/api/telemetry";

  if (!http.begin(client, url)) {
    Serial.println("[HTTP] begin gagal");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  int code = http.POST(payload);
  if (code == 200) {
    String resp = http.getString();
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, resp);
    if (err) {
      Serial.print("[HTTP] balasan tidak terbaca: ");
      Serial.println(err.c_str());
    } else {
      // Yang sudah terkirim boleh dibuang; perintah baru dijalankan sekarang.
      jumlahEvent = 0;
      jumlahAck = 0;
      selaraskanJam(doc["epoch_wib"] | 0UL);
      terapkanSetelan(doc["settings"].as<JsonObjectConst>());
      for (JsonObjectConst cmd : doc["commands"].as<JsonArrayConst>()) {
        jalankanPerintah(cmd);
      }
      if (!pernahTerkirim) {
        Serial.println("[HTTP] tersambung ke server, telemetri terkirim.");
        pernahTerkirim = true;
      }
    }
  } else {
    // Sisa heap ikut dicetak: buffer TLS 16 KB dialokasikan saat menyambung,
    // jadi kegagalan karena kehabisan memori harus bisa dibedakan dari
    // kegagalan karena sinyal WiFi lemah.
    Serial.print("[HTTP] gagal, kode ");
    Serial.print(code);
    Serial.print(", heap ");
    Serial.print(ESP.getFreeHeap());
    Serial.print(", blok ");
    Serial.print(ESP.getMaxFreeBlockSize());   // buffer 16 KB butuh satu blok utuh
    Serial.print(", ssl ");
    Serial.print(client.getLastSSLError());
    Serial.print(", rssi ");
    Serial.println(WiFi.RSSI());
  }
  http.end();

  // Permintaan di atas memblokir sampai 6 detik. Pompa dan servo sama-sama
  // punya batas waktu, jadi keduanya diperiksa lagi begitu POST selesai.
  // Tanpa baris kedua, servo bisa menuang 3 detik lalu tertahan terbuka
  // selama sisa POST.
  kontrolPompa();
  prosesPakan();
}

// ==========================================
// WIFI
// ==========================================
void jagaWifi() {
  static unsigned long terakhirCoba = 0;
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - terakhirCoba < 10000UL) return;
  terakhirCoba = millis();
  // Kode status membedakan SSID hilang (1), gagal (4), sandi salah (6), dan putus (7).
  Serial.print("[WIFI] menyambung ulang, status ");
  Serial.println(WiFi.status());
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

// ==========================================
// SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("AQUASMART mulai");

  randomSeed(micros() ^ ESP.getChipId());
  penandaBoot = (uint32_t)random(0x7FFFFFFF);

  relayAktif(false);                 // pompa dipastikan mati saat boot

  pinMode(WATER_POWER, OUTPUT);
  digitalWrite(WATER_POWER, LOW);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  // Posisi tutup ikut diberikan saat attach. attach(pin) saja langsung
  // menggerakkan servo ke tengah (sama dengan posisi buka), sehingga wadah
  // pakan terbuka sesaat setiap kali alat menyala. Posisi fisik servo saat boot
  // tidak diketahui, jadi di sini tidak bisa bergerak perlahan.
  servoPakan.attach(SERVO_PIN, SERVO_MIN_US, SERVO_MAX_US, SERVO_TUTUP);
  waktuServoGerak = millis();

  Rtc.Begin();
  Rtc.SetIsWriteProtected(false);

  // Penjadwalan pakan sepenuhnya bergantung pada jam ini, jadi keadaannya
  // dicetak saat boot. Kalau baterai RTC habis, jam akan mundur ke waktu
  // kompilasi pada setiap boot dan pakan otomatis jatuh di jam yang salah
  // tanpa ada yang menyadarinya.
  bool rtcDisetelUlang = !Rtc.IsDateTimeValid();
  if (rtcDisetelUlang) Rtc.SetDateTime(RtcDateTime(__DATE__, __TIME__));
  if (!Rtc.GetIsRunning()) Rtc.SetIsRunning(true);

  RtcDateTime jamSekarang = Rtc.GetDateTime();
  char penanda[32];
  snprintf(penanda, sizeof(penanda), "%04u-%02u-%02u %02u:%02u:%02u",
           jamSekarang.Year(), jamSekarang.Month(), jamSekarang.Day(),
           jamSekarang.Hour(), jamSekarang.Minute(), jamSekarang.Second());
  Serial.print("[RTC] ");
  Serial.println(penanda);
  if (rtcDisetelUlang) {
    Serial.println("[RTC] PERINGATAN: jam tidak sah, disetel ke waktu kompilasi.");
  }
  if (!jamMasukAkal()) {
    Serial.println("[RTC] Tahunnya di luar akal. Jadwal otomatis ditahan sampai");
    Serial.println("[RTC] server menyelaraskan jam. Periksa baterai RTC.");
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WIFI] menyambung ke ");
  Serial.println(WIFI_SSID);

  unsigned long mulai = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - mulai < 20000UL) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WIFI] tersambung, IP ");
    Serial.println(WiFi.localIP());
  } else {
    // Tidak menggantung di sini: sensor dan otomasi tetap harus jalan offline.
    Serial.println("[WIFI] belum tersambung, lanjut mode lokal.");
  }

  pengukuranPertama = true;
}

void loop() {
  jagaWifi();
  monitoringAir();
  kontrolPompa();
  monitoringPakan();
  cekJadwalRTC();
  prosesPakan();
  jalankanServo();

  if (millis() - waktuKirimTerakhir >= INTERVAL_KIRIM) {
    waktuKirimTerakhir = millis();
    kirimTelemetri();
  }
}
