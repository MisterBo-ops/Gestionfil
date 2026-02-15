-- Table des utilisateurs (Chef, Team Leader, Conseillers)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('chef', 'team_leader', 'conseiller')),
  is_active INTEGER DEFAULT 1,
  is_available INTEGER DEFAULT 0, -- Pour les conseillers: disponible ou occupé
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Table des clients en file d'attente
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  numero_mtn TEXT NOT NULL,
  second_contact TEXT,
  raison_visite TEXT NOT NULL,
  type_client TEXT NOT NULL CHECK(type_client IN ('HVC_OR', 'HVC_BRONZE', 'HVC_ARGENT', 'NON_HVC')),
  priority INTEGER NOT NULL, -- 1=VIP(HVC_OR), 2=HVC_BRONZE/ARGENT, 3=NON_HVC
  status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'in_service', 'completed', 'cancelled')),
  
  -- Timestamps de suivi
  arrival_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  service_start_time DATETIME,
  service_end_time DATETIME,
  
  -- Temps calculés (en minutes)
  waiting_time_minutes INTEGER,
  service_time_minutes INTEGER,
  total_time_minutes INTEGER,
  
  -- Assignations
  registered_by INTEGER NOT NULL, -- Agent d'accueil
  served_by INTEGER, -- Conseiller qui traite
  
  -- Alertes
  vip_alert_sent INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (registered_by) REFERENCES users(id),
  FOREIGN KEY (served_by) REFERENCES users(id)
);

-- Table des sessions de connexion
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  logout_time DATETIME,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Table des rapports d'activité (pour statistiques)
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  client_id INTEGER,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_priority ON clients(priority, arrival_time);
CREATE INDEX IF NOT EXISTS idx_clients_arrival ON clients(arrival_time);
CREATE INDEX IF NOT EXISTS idx_clients_served_by ON clients(served_by);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs(created_at);
