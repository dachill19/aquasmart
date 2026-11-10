-- AQUASMART telemetry store. Timestamps are server-side epoch milliseconds so the
-- device never has to be trusted for time (its RTC drifts and resets to compile time).

DROP TABLE IF EXISTS readings;
CREATE TABLE readings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,
  level_air    INTEGER,
  raw_water    INTEGER,
  stok_pakan   INTEGER,
  jarak_pakan  REAL,
  pompa        INTEGER,
  terkunci     INTEGER,
  status_air   TEXT,
  status_pakan TEXT,
  rssi         INTEGER,
  uptime_ms    INTEGER
);
CREATE INDEX idx_readings_ts ON readings (ts DESC);

-- One row per command the dashboard issues. The device claims pending rows on its
-- next telemetry post and acknowledges them on the post after that.
DROP TABLE IF EXISTS commands;
CREATE TABLE commands (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  type     TEXT NOT NULL,
  payload  TEXT,
  sent_at  INTEGER,
  acked_at INTEGER
);
CREATE INDEX idx_commands_pending ON commands (acked_at, id);

-- Notifications the firmware used to push through Blynk events.
DROP TABLE IF EXISTS events;
CREATE TABLE events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,
  kind    TEXT NOT NULL,
  message TEXT,
  -- The device's own id for this event, "<random boot marker>-<counter>".
  -- Telemetry delivery is at-least-once, so a lost response makes the device
  -- resend its queue; the unique index below turns the repeat into a no-op.
  -- Rows written before this column existed hold NULL, and SQLite allows any
  -- number of NULLs in a unique index.
  ext_id  TEXT
);
CREATE INDEX idx_events_ts ON events (ts DESC);
CREATE UNIQUE INDEX idx_events_ext ON events (ext_id);

-- Settings live here instead of in device RAM, so a reboot no longer loses them.
-- This is fix #5 in FIRMWARE_FIXES.md.
DROP TABLE IF EXISTS settings;
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
  ('jam_pagi',      '7'),
  ('menit_pagi',    '0'),
  ('jam_sore',      '17'),
  ('menit_sore',    '0'),
  ('durasi_pakan',  '3'),
  ('durasi_pompa',  '5'),
  ('batas_air',     '30'),
  -- Where the pump stops filling. It has to be a separate number from
  -- batas_air: when both were the same, the pump cut out the instant the level
  -- crossed back over the line that started it and the tank never filled.
  ('target_air',    '80'),
  ('batas_pakan',   '30'),
  -- Sensor calibration. Kept here rather than in the firmware so re-measuring
  -- the rig costs an edit in the dashboard instead of a re-flash.
  -- air_kering / air_basah are raw ADC counts; the pakan pair is millimetres
  -- from the sensor face. All four were measured on the rig, not estimated.
  --
  -- Both water points are operating limits rather than physical ones: 0% is
  -- the dry strip (it reads 3-10) and 100% is the highest level that still
  -- clears the sensor's unprotected header wiring. At that height the strip
  -- swings between 187 and 235 counts, so 210 is the typical reading rather
  -- than the peak. Erring low only makes the pump stop early; erring high
  -- makes it keep filling past the wiring, so the typical value is the safe
  -- choice.
  ('air_kering',       '10'),
  ('air_basah',       '210'),
  ('pakan_penuh_mm',   '35'),
  ('pakan_kosong_mm',  '82');
