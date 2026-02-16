-- Ajouter les colonnes pour le système de tickets
ALTER TABLE clients ADD COLUMN ticket_number TEXT;
ALTER TABLE clients ADD COLUMN qr_code TEXT;

-- Ajouter les colonnes pour la gestion des pauses
ALTER TABLE users ADD COLUMN on_break INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN break_start_time DATETIME;
ALTER TABLE users ADD COLUMN total_break_time_minutes INTEGER DEFAULT 0;

-- Créer une table pour historique des pauses
CREATE TABLE IF NOT EXISTS breaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  break_start DATETIME NOT NULL,
  break_end DATETIME,
  duration_minutes INTEGER,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index pour les pauses
CREATE INDEX IF NOT EXISTS idx_breaks_user_id ON breaks(user_id);
CREATE INDEX IF NOT EXISTS idx_breaks_date ON breaks(break_start);

-- Créer une table pour les compteurs de tickets (par jour)
CREATE TABLE IF NOT EXISTS ticket_counters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  counter INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
