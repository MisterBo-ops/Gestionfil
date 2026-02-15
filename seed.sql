-- Données initiales pour tester le système

-- Créer un chef d'agence par défaut (password: admin123)
INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role, is_active) 
VALUES (1, 'admin', '$2a$10$M5eNS9BjABXqQa3NAsbdLuQvpHYF32.zq2ojfNGqck5/ovpBOR9DC', 'Chef Agence', 'chef', 1);

-- Créer un team leader par défaut (password: team123)
INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role, is_active, created_by) 
VALUES (2, 'teamleader', '$2a$10$WjsI50uQYw8XiRmHc1Ru4OB7s9ulnZ.wf2BTtGhzPUAepVEzkFcTa', 'Team Leader 1', 'team_leader', 1, 1);

-- Créer quelques conseillers test (password: conseil123)
INSERT OR IGNORE INTO users (username, password_hash, full_name, role, is_active, is_available, created_by) 
VALUES 
  ('conseiller1', '$2a$10$IVFPAw2NBw.d1juLc.S5wuRmmnALt5ynq9wH4Wz4nT1AVC.RSfzZG', 'Conseiller Marie Diallo', 'conseiller', 1, 1, 1),
  ('conseiller2', '$2a$10$IVFPAw2NBw.d1juLc.S5wuRmmnALt5ynq9wH4Wz4nT1AVC.RSfzZG', 'Conseiller Jean Kouassi', 'conseiller', 1, 1, 1),
  ('conseiller3', '$2a$10$IVFPAw2NBw.d1juLc.S5wuRmmnALt5ynq9wH4Wz4nT1AVC.RSfzZG', 'Conseiller Fatou Ndiaye', 'conseiller', 1, 1, 1);

-- Quelques clients test en file d'attente
INSERT OR IGNORE INTO clients (nom, prenom, numero_mtn, raison_visite, type_client, priority, registered_by, status) 
VALUES 
  ('Touré', 'Amadou', '0789123456', 'Problème de forfait', 'HVC_OR', 1, 1, 'waiting'),
  ('Kamara', 'Aïcha', '0789234567', 'Recharge crédit', 'NON_HVC', 3, 1, 'waiting'),
  ('Koné', 'Ibrahim', '0789345678', 'Changement de carte SIM', 'HVC_BRONZE', 2, 1, 'waiting');
