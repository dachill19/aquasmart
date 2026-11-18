-- One-off upgrade of the single-device production database to multi-device.
-- Run once, after a full `wrangler d1 export` backup:
--   npx wrangler d1 execute aquasmart --remote --file migrations/2026-11-18-multi-device.sql
-- and deploy the matching Worker right after. Fresh databases use schema.sql.
--
-- Every existing row belongs to the real ESP8266, which becomes Akuarium 01.
-- No BEGIN/COMMIT: D1 rejects explicit transactions and runs the file as one unit.

CREATE TABLE devices (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  simulated INTEGER NOT NULL DEFAULT 0,
  key_hash  TEXT UNIQUE
);
INSERT INTO devices (id, name, simulated, key_hash) VALUES
  (1, 'Akuarium 01', 0, NULL),
  (2, 'Akuarium 02', 1, 'placeholder-2'),
  (3, 'Akuarium 03', 1, 'placeholder-3');

ALTER TABLE readings ADD COLUMN device_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE commands ADD COLUMN device_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE events   ADD COLUMN device_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX idx_readings_device_ts ON readings (device_id, ts DESC);
DROP INDEX IF EXISTS idx_commands_pending;
CREATE INDEX idx_commands_device_pending ON commands (device_id, acked_at, id);
DROP INDEX IF EXISTS idx_events_ts;
CREATE INDEX idx_events_device_ts ON events (device_id, ts DESC);

-- settings needs a composite primary key, which SQLite cannot add in place.
CREATE TABLE settings_new (
  device_id INTEGER NOT NULL,
  key       TEXT NOT NULL,
  value     TEXT NOT NULL,
  PRIMARY KEY (device_id, key)
);
INSERT INTO settings_new (device_id, key, value) SELECT 1, key, value FROM settings;

-- Defaults for the simulated aquariums, and for any key device 1 never had.
-- OR IGNORE keeps every value device 1 already stores.
INSERT OR IGNORE INTO settings_new (device_id, key, value)
WITH defaults (key, value) AS (VALUES
  ('jam_pagi', '7'), ('menit_pagi', '0'), ('jam_sore', '17'), ('menit_sore', '0'),
  ('durasi_pakan', '3'), ('durasi_pompa', '5'), ('batas_air', '30'), ('target_air', '80'),
  ('batas_pakan', '30'), ('air_kering', '10'), ('air_basah', '210'),
  ('pakan_penuh_mm', '35'), ('pakan_kosong_mm', '82')
)
SELECT d.id, defaults.key, defaults.value FROM devices d CROSS JOIN defaults;

DROP TABLE settings;
ALTER TABLE settings_new RENAME TO settings;
