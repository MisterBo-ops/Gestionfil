-- Ajouter des clients terminés pour tester les statistiques
-- Clients d'aujourd'hui avec des heures variées
INSERT INTO clients (nom, prenom, numero_mtn, raison_visite, type_client, priority, status, registered_by, served_by, 
  arrival_time, service_start_time, service_end_time, waiting_time_minutes, service_time_minutes, total_time_minutes)
VALUES
  ('Diallo', 'Fatima', '0701234567', 'Activation Internet', 'HVC_OR', 1, 'completed', 1, 3,
   datetime('now', '-5 hours'), datetime('now', '-5 hours', '+3 minutes'), datetime('now', '-5 hours', '+15 minutes'), 3, 12, 15),
  
  ('Sy', 'Moussa', '0702345678', 'Rechargement', 'NON_HVC', 3, 'completed', 1, 4,
   datetime('now', '-4 hours'), datetime('now', '-4 hours', '+10 minutes'), datetime('now', '-4 hours', '+18 minutes'), 10, 8, 18),
  
  ('Keita', 'Aminata', '0703456789', 'Activation forfait', 'HVC_BRONZE', 2, 'completed', 2, 3,
   datetime('now', '-3 hours'), datetime('now', '-3 hours', '+5 minutes'), datetime('now', '-3 hours', '+16 minutes'), 5, 11, 16),
  
  ('Ba', 'Ibrahim', '0704567890', 'Support technique', 'HVC_OR', 1, 'completed', 1, 5,
   datetime('now', '-2 hours'), datetime('now', '-2 hours', '+2 minutes'), datetime('now', '-2 hours', '+20 minutes'), 2, 18, 20),
  
  ('Cisse', 'Mariam', '0705678901', 'Activation SIM', 'NON_HVC', 3, 'completed', 2, 4,
   datetime('now', '-1 hour'), datetime('now', '-1 hour', '+15 minutes'), datetime('now', '-1 hour', '+28 minutes'), 15, 13, 28);

-- Clients d'hier
INSERT INTO clients (nom, prenom, numero_mtn, raison_visite, type_client, priority, status, registered_by, served_by, 
  arrival_time, service_start_time, service_end_time, waiting_time_minutes, service_time_minutes, total_time_minutes)
VALUES
  ('Ndiaye', 'Ousmane', '0706789012', 'Activation forfait', 'HVC_ARGENT', 2, 'completed', 1, 3,
   datetime('now', '-1 day', '-3 hours'), datetime('now', '-1 day', '-3 hours', '+6 minutes'), datetime('now', '-1 day', '-3 hours', '+20 minutes'), 6, 14, 20),
  
  ('Sow', 'Awa', '0707890123', 'Rechargement', 'NON_HVC', 3, 'completed', 1, 4,
   datetime('now', '-1 day', '-2 hours'), datetime('now', '-1 day', '-2 hours', '+8 minutes'), datetime('now', '-1 day', '-2 hours', '+18 minutes'), 8, 10, 18);
