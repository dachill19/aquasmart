-- AQUASMART telemetry store. Timestamps are server-side epoch milliseconds so the
-- device never has to be trusted for time (its RTC drifts and resets to compile time).
--
-- This file builds a fresh database. An existing single-device database is
-- upgraded with migrations/2026-11-18-multi-device.sql instead.

-- One row per aquarium. Device 1 is the real ESP8266 and is authenticated by the
-- DEVICE_KEY Worker secret, so its key never enters this repository. Every other
-- device proves itself with a key whose SHA-256 hex is stored here; the plain
-- keys of the simulated devices live only in the gitignored simulator/devices.json.
DROP TABLE IF EXISTS devices;
CREATE TABLE devices (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  simulated INTEGER NOT NULL DEFAULT 0,
  key_hash  TEXT UNIQUE
);
INSERT INTO devices (id, name, simulated, key_hash) VALUES
  (1, 'Akuarium 01', 0, NULL),
  (2, 'Akuarium 02', 1, '849bc9f5a21414bc1f84247d95ab70c4c069b1efaea55f43e9cff6e34581210e'),
  (3, 'Akuarium 03', 1, 'c645370e7edb5a3c6f94e3b56e5f741e916cdea9ffa919eb279e05634b02afa1');

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
  uptime_ms    INTEGER,
  device_id    INTEGER NOT NULL DEFAULT 1
);
-- ts alone serves the 7-day cleanup, which spans every device.
CREATE INDEX idx_readings_ts ON readings (ts DESC);
CREATE INDEX idx_readings_device_ts ON readings (device_id, ts DESC);

-- One row per command the dashboard issues. The device claims pending rows on its
-- next telemetry post and acknowledges them on the post after that.
DROP TABLE IF EXISTS commands;
CREATE TABLE commands (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  type      TEXT NOT NULL,
  payload   TEXT,
  sent_at   INTEGER,
  acked_at  INTEGER,
  device_id INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_commands_device_pending ON commands (device_id, acked_at, id);

-- Notifications the firmware used to push through Blynk events.
DROP TABLE IF EXISTS events;
CREATE TABLE events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  kind      TEXT NOT NULL,
  message   TEXT,
  -- The device's own id for this event, "<random boot marker>-<counter>".
  -- Telemetry delivery is at-least-once, so a lost response makes the device
  -- resend its queue; the unique index below turns the repeat into a no-op.
  -- Unique per device, so one device can never suppress another's event by
  -- sending the same id. Rows written before this column existed hold NULL,
  -- and SQLite allows any number of NULLs in a unique index.
  ext_id    TEXT,
  device_id INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_events_device_ts ON events (device_id, ts DESC);
CREATE UNIQUE INDEX idx_events_device_ext ON events (device_id, ext_id);

-- Settings live here instead of in device RAM, so a reboot no longer loses them.
-- Each aquarium has its own copy, including its own sensor calibration.
DROP TABLE IF EXISTS settings;
CREATE TABLE settings (
  device_id INTEGER NOT NULL,
  key       TEXT NOT NULL,
  value     TEXT NOT NULL,
  PRIMARY KEY (device_id, key)
);

INSERT INTO settings (device_id, key, value)
WITH defaults (key, value) AS (VALUES
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
  ('pakan_kosong_mm',  '82')
)
SELECT d.id, defaults.key, defaults.value FROM devices d CROSS JOIN defaults;
