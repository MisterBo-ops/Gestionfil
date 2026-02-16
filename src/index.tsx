import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import bcrypt from 'bcryptjs'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('/api/*', cors())

// Serve PWA files from root
app.get('/manifest.json', (c) => c.redirect('/static/manifest.json'))
app.get('/sw.js', (c) => c.redirect('/static/sw.js'))

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// ============= HELPER FUNCTIONS =============

// Vérifier l'authentification
async function verifySession(db: D1Database, token: string) {
  const result = await db.prepare(`
    SELECT u.*, s.id as session_id 
    FROM users u
    INNER JOIN sessions s ON u.id = s.user_id
    WHERE s.session_token = ? AND s.is_active = 1 AND u.is_active = 1
  `).bind(token).first()
  
  return result || null
}

// Générer un token de session
function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Calculer la priorité
function calculatePriority(typeClient: string): number {
  switch(typeClient) {
    case 'HVC_OR': return 1
    case 'HVC_BRONZE':
    case 'HVC_ARGENT': return 2
    default: return 3
  }
}

// ============= API ROUTES =============

// Login
app.post('/api/auth/login', async (c) => {
  try {
    const { username, password } = await c.req.json()
    
    const user = await c.env.DB.prepare(`
      SELECT * FROM users WHERE username = ? AND is_active = 1
    `).bind(username).first()
    
    if (!user) {
      return c.json({ error: 'Identifiants invalides' }, 401)
    }
    
    // Vérifier le mot de passe
    const isValid = await bcrypt.compare(password, user.password_hash as string)
    if (!isValid) {
      return c.json({ error: 'Identifiants invalides' }, 401)
    }
    
    // Créer une session
    const token = generateToken()
    await c.env.DB.prepare(`
      INSERT INTO sessions (user_id, session_token) VALUES (?, ?)
    `).bind(user.id, token).run()
    
    // Log l'activité
    await c.env.DB.prepare(`
      INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)
    `).bind(user.id, 'login', `Connexion réussie`).run()
    
    return c.json({ 
      token, 
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        is_available: user.is_available
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Logout
app.post('/api/auth/logout', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const user = await verifySession(c.env.DB, token)
    if (!user) {
      return c.json({ error: 'Session invalide' }, 401)
    }
    
    // Désactiver la session
    await c.env.DB.prepare(`
      UPDATE sessions SET is_active = 0, logout_time = CURRENT_TIMESTAMP 
      WHERE session_token = ?
    `).bind(token).run()
    
    // Si conseiller, le rendre indisponible
    if (user.role === 'conseiller') {
      await c.env.DB.prepare(`
        UPDATE users SET is_available = 0 WHERE id = ?
      `).bind(user.id).run()
    }
    
    // Log l'activité
    await c.env.DB.prepare(`
      INSERT INTO activity_logs (user_id, action) VALUES (?, ?)
    `).bind(user.id, 'logout').run()
    
    return c.json({ message: 'Déconnexion réussie' })
  } catch (error) {
    console.error('Logout error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Vérifier la session
app.get('/api/auth/me', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const user = await verifySession(c.env.DB, token)
    if (!user) {
      return c.json({ error: 'Session invalide' }, 401)
    }
    
    return c.json({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      is_available: user.is_available
    })
  } catch (error) {
    console.error('Auth check error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// ============= GESTION DES CONSEILLERS (Chef/Team Leader) =============

// Créer un conseiller
app.post('/api/users/conseiller', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser || !['chef', 'team_leader'].includes(currentUser.role as string)) {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    const { username, password, full_name } = await c.req.json()
    
    // Vérifier si le username existe déjà
    const existing = await c.env.DB.prepare(`
      SELECT id FROM users WHERE username = ?
    `).bind(username).first()
    
    if (existing) {
      return c.json({ error: 'Ce nom d\'utilisateur existe déjà' }, 400)
    }
    
    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10)
    
    // Créer le conseiller
    const result = await c.env.DB.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, is_active, is_available, created_by)
      VALUES (?, ?, ?, 'conseiller', 1, 1, ?)
    `).bind(username, passwordHash, full_name, currentUser.id).run()
    
    // Log l'activité
    await c.env.DB.prepare(`
      INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)
    `).bind(currentUser.id, 'create_conseiller', `Création du conseiller ${full_name}`).run()
    
    return c.json({ 
      message: 'Conseiller créé avec succès',
      id: result.meta.last_row_id
    })
  } catch (error) {
    console.error('Create conseiller error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Liste des conseillers
app.get('/api/users/conseillers', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser) {
      return c.json({ error: 'Session invalide' }, 401)
    }
    
    const conseillers = await c.env.DB.prepare(`
      SELECT id, username, full_name, is_active, is_available, created_at
      FROM users 
      WHERE role = 'conseiller'
      ORDER BY full_name
    `).all()
    
    return c.json({ conseillers: conseillers.results })
  } catch (error) {
    console.error('Get conseillers error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Activer/Désactiver un conseiller
app.patch('/api/users/conseiller/:id/toggle', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser || !['chef', 'team_leader'].includes(currentUser.role as string)) {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    const conseillerId = c.req.param('id')
    
    const conseiller = await c.env.DB.prepare(`
      SELECT is_active FROM users WHERE id = ? AND role = 'conseiller'
    `).bind(conseillerId).first()
    
    if (!conseiller) {
      return c.json({ error: 'Conseiller non trouvé' }, 404)
    }
    
    const newStatus = conseiller.is_active === 1 ? 0 : 1
    
    await c.env.DB.prepare(`
      UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(newStatus, conseillerId).run()
    
    // Log l'activité
    const action = newStatus === 1 ? 'activate_conseiller' : 'deactivate_conseiller'
    await c.env.DB.prepare(`
      INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)
    `).bind(currentUser.id, action, `Conseiller ID: ${conseillerId}`).run()
    
    return c.json({ message: 'Statut mis à jour', is_active: newStatus })
  } catch (error) {
    console.error('Toggle conseiller error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Modifier un conseiller
app.patch('/api/users/conseiller/:id', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser || !['chef', 'team_leader'].includes(currentUser.role as string)) {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    const conseillerId = c.req.param('id')
    const { username, full_name, password } = await c.req.json()
    
    // Vérifier que le conseiller existe
    const conseiller = await c.env.DB.prepare(`
      SELECT id, username FROM users WHERE id = ? AND role = 'conseiller'
    `).bind(conseillerId).first()
    
    if (!conseiller) {
      return c.json({ error: 'Conseiller non trouvé' }, 404)
    }
    
    // Vérifier si le nouveau username existe déjà (si différent de l'actuel)
    if (username && username !== conseiller.username) {
      const existing = await c.env.DB.prepare(`
        SELECT id FROM users WHERE username = ? AND id != ?
      `).bind(username, conseillerId).first()
      
      if (existing) {
        return c.json({ error: 'Ce nom d\'utilisateur existe déjà' }, 400)
      }
    }
    
    // Préparer les champs à mettre à jour
    const updates: string[] = []
    const values: any[] = []
    
    if (full_name) {
      updates.push('full_name = ?')
      values.push(full_name)
    }
    
    if (username) {
      updates.push('username = ?')
      values.push(username)
    }
    
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10)
      updates.push('password_hash = ?')
      values.push(passwordHash)
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(conseillerId)
    
    if (updates.length > 1) { // > 1 car updated_at est toujours présent
      await c.env.DB.prepare(`
        UPDATE users SET ${updates.join(', ')} WHERE id = ?
      `).bind(...values).run()
      
      // Log l'activité
      await c.env.DB.prepare(`
        INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)
      `).bind(currentUser.id, 'update_conseiller', `Modification du conseiller ID: ${conseillerId}`).run()
      
      return c.json({ message: 'Conseiller modifié avec succès' })
    } else {
      return c.json({ error: 'Aucune modification fournie' }, 400)
    }
  } catch (error) {
    console.error('Update conseiller error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Supprimer un conseiller
app.delete('/api/users/conseiller/:id', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser || !['chef', 'team_leader'].includes(currentUser.role as string)) {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    const conseillerId = c.req.param('id')
    
    // Vérifier que le conseiller existe
    const conseiller = await c.env.DB.prepare(`
      SELECT id, full_name FROM users WHERE id = ? AND role = 'conseiller'
    `).bind(conseillerId).first()
    
    if (!conseiller) {
      return c.json({ error: 'Conseiller non trouvé' }, 404)
    }
    
    // Vérifier qu'il n'a pas de client en cours
    const activeClient = await c.env.DB.prepare(`
      SELECT id FROM clients WHERE served_by = ? AND status = 'in_service'
    `).bind(conseillerId).first()
    
    if (activeClient) {
      return c.json({ error: 'Impossible de supprimer: le conseiller a un client en cours' }, 400)
    }
    
    // Désactiver toutes les sessions du conseiller
    await c.env.DB.prepare(`
      UPDATE sessions SET is_active = 0, logout_time = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND is_active = 1
    `).bind(conseillerId).run()
    
    // Supprimer le conseiller
    await c.env.DB.prepare(`
      DELETE FROM users WHERE id = ?
    `).bind(conseillerId).run()
    
    // Log l'activité
    await c.env.DB.prepare(`
      INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)
    `).bind(currentUser.id, 'delete_conseiller', `Suppression du conseiller: ${conseiller.full_name}`).run()
    
    return c.json({ message: 'Conseiller supprimé avec succès' })
  } catch (error) {
    console.error('Delete conseiller error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// ============= GESTION DES CLIENTS =============

// Enregistrer un client (tous les agents)
app.post('/api/clients', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser) {
      return c.json({ error: 'Session invalide' }, 401)
    }
    
    const { nom, prenom, numero_mtn, second_contact, raison_visite, type_client } = await c.req.json()
    
    const priority = calculatePriority(type_client)
    
    // Générer le numéro de ticket
    const ticketNumber = await generateTicketNumber(c.env.DB)
    const qrCodeData = generateQRCodeData(ticketNumber, { nom, prenom, type_client })
    
    const result = await c.env.DB.prepare(`
      INSERT INTO clients (nom, prenom, numero_mtn, second_contact, raison_visite, type_client, priority, registered_by, ticket_number, qr_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(nom, prenom, numero_mtn, second_contact || null, raison_visite, type_client, priority, currentUser.id, ticketNumber, qrCodeData).run()
    
    // Log l'activité
    await c.env.DB.prepare(`
      INSERT INTO activity_logs (user_id, action, client_id, details) 
      VALUES (?, ?, ?, ?)
    `).bind(currentUser.id, 'register_client', result.meta.last_row_id, `Client: ${prenom} ${nom} - Ticket: ${ticketNumber}`).run()
    
    return c.json({ 
      message: 'Client enregistré avec succès',
      client_id: result.meta.last_row_id,
      priority,
      ticket_number: ticketNumber,
      qr_code: qrCodeData
    })
  } catch (error) {
    console.error('Register client error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// File d'attente (tous les agents connectés)
app.get('/api/clients/queue', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser) {
      return c.json({ error: 'Session invalide' }, 401)
    }
    
    // Obtenir la file d'attente triée par priorité puis par heure d'arrivée
    const queue = await c.env.DB.prepare(`
      SELECT 
        c.*,
        u.full_name as registered_by_name,
        CAST((julianday('now') - julianday(c.arrival_time)) * 24 * 60 AS INTEGER) as current_waiting_minutes
      FROM clients c
      LEFT JOIN users u ON c.registered_by = u.id
      WHERE c.status = 'waiting'
      ORDER BY c.priority ASC, c.arrival_time ASC
    `).all()
    
    return c.json({ queue: queue.results })
  } catch (error) {
    console.error('Get queue error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Appeler un client (conseiller uniquement)
app.post('/api/clients/:id/call', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser || currentUser.role !== 'conseiller') {
      return c.json({ error: 'Seuls les conseillers peuvent appeler des clients' }, 403)
    }
    
    // Vérifier si le conseiller est disponible
    if (currentUser.is_available === 0) {
      return c.json({ error: 'Vous devez terminer avec votre client actuel avant d\'en appeler un autre' }, 400)
    }
    
    const clientId = c.req.param('id')
    
    // Vérifier que le client est en attente
    const client = await c.env.DB.prepare(`
      SELECT * FROM clients WHERE id = ? AND status = 'waiting'
    `).bind(clientId).first()
    
    if (!client) {
      return c.json({ error: 'Client non trouvé ou déjà pris en charge' }, 404)
    }
    
    // Calculer le temps d'attente
    const waitingMinutes = await c.env.DB.prepare(`
      SELECT CAST((julianday('now') - julianday(arrival_time)) * 24 * 60 AS INTEGER) as minutes
      FROM clients WHERE id = ?
    `).bind(clientId).first()
    
    // Mettre à jour le client
    await c.env.DB.prepare(`
      UPDATE clients 
      SET status = 'in_service',
          served_by = ?,
          service_start_time = CURRENT_TIMESTAMP,
          waiting_time_minutes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(currentUser.id, waitingMinutes?.minutes || 0, clientId).run()
    
    // Marquer le conseiller comme occupé
    await c.env.DB.prepare(`
      UPDATE users SET is_available = 0 WHERE id = ?
    `).bind(currentUser.id).run()
    
    // Log l'activité
    await c.env.DB.prepare(`
      INSERT INTO activity_logs (user_id, action, client_id, details) 
      VALUES (?, ?, ?, ?)
    `).bind(currentUser.id, 'call_client', clientId, 'Début du service').run()
    
    return c.json({ 
      message: 'Client appelé avec succès',
      waiting_time_minutes: waitingMinutes?.minutes || 0
    })
  } catch (error) {
    console.error('Call client error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Terminer avec un client (conseiller uniquement)
app.post('/api/clients/:id/complete', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser || currentUser.role !== 'conseiller') {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    const clientId = c.req.param('id')
    
    // Vérifier que le client est en service avec ce conseiller
    const client = await c.env.DB.prepare(`
      SELECT * FROM clients 
      WHERE id = ? AND status = 'in_service' AND served_by = ?
    `).bind(clientId, currentUser.id).first()
    
    if (!client) {
      return c.json({ error: 'Client non trouvé ou non assigné à vous' }, 404)
    }
    
    // Calculer le temps de service
    const serviceMinutes = await c.env.DB.prepare(`
      SELECT CAST((julianday('now') - julianday(service_start_time)) * 24 * 60 AS INTEGER) as minutes
      FROM clients WHERE id = ?
    `).bind(clientId).first()
    
    // Calculer le temps total
    const totalMinutes = await c.env.DB.prepare(`
      SELECT CAST((julianday('now') - julianday(arrival_time)) * 24 * 60 AS INTEGER) as minutes
      FROM clients WHERE id = ?
    `).bind(clientId).first()
    
    // Mettre à jour le client
    await c.env.DB.prepare(`
      UPDATE clients 
      SET status = 'completed',
          service_end_time = CURRENT_TIMESTAMP,
          service_time_minutes = ?,
          total_time_minutes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(serviceMinutes?.minutes || 0, totalMinutes?.minutes || 0, clientId).run()
    
    // Marquer le conseiller comme disponible
    await c.env.DB.prepare(`
      UPDATE users SET is_available = 1 WHERE id = ?
    `).bind(currentUser.id).run()
    
    // Log l'activité
    await c.env.DB.prepare(`
      INSERT INTO activity_logs (user_id, action, client_id, details) 
      VALUES (?, ?, ?, ?)
    `).bind(currentUser.id, 'complete_client', clientId, 'Service terminé').run()
    
    return c.json({ 
      message: 'Service terminé avec succès',
      service_time_minutes: serviceMinutes?.minutes || 0,
      total_time_minutes: totalMinutes?.minutes || 0
    })
  } catch (error) {
    console.error('Complete client error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Mon client actuel (conseiller)
app.get('/api/clients/current', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser || currentUser.role !== 'conseiller') {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    const client = await c.env.DB.prepare(`
      SELECT 
        c.*,
        CAST((julianday('now') - julianday(c.service_start_time)) * 24 * 60 AS INTEGER) as current_service_minutes
      FROM clients c
      WHERE c.served_by = ? AND c.status = 'in_service'
    `).bind(currentUser.id).first()
    
    return c.json({ client: client || null })
  } catch (error) {
    console.error('Get current client error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// ============= DASHBOARD (Chef/Team Leader) =============

// Agents connectés
app.get('/api/dashboard/agents', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser || !['chef', 'team_leader'].includes(currentUser.role as string)) {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    // Agents connectés (sessions actives)
    const connectedAgents = await c.env.DB.prepare(`
      SELECT DISTINCT 
        u.id, u.full_name, u.role, u.is_available,
        s.login_time,
        c.id as current_client_id,
        c.nom || ' ' || c.prenom as current_client_name
      FROM users u
      INNER JOIN sessions s ON u.id = s.user_id AND s.is_active = 1
      LEFT JOIN clients c ON u.id = c.served_by AND c.status = 'in_service'
      WHERE u.is_active = 1
      ORDER BY u.role, u.full_name
    `).all()
    
    return c.json({ agents: connectedAgents.results })
  } catch (error) {
    console.error('Get agents error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Statistiques en temps réel
app.get('/api/dashboard/stats', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser || !['chef', 'team_leader'].includes(currentUser.role as string)) {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    // Clients en attente
    const waiting = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM clients WHERE status = 'waiting'
    `).first()
    
    // Clients en service
    const inService = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM clients WHERE status = 'in_service'
    `).first()
    
    // Clients traités aujourd'hui
    const completedToday = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM clients 
      WHERE status = 'completed' AND DATE(arrival_time) = DATE('now')
    `).first()
    
    // Conseillers disponibles
    const availableConseillers = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE role = 'conseiller' AND is_active = 1 AND is_available = 1
    `).first()
    
    // Temps d'attente moyen aujourd'hui
    const avgWaitingTime = await c.env.DB.prepare(`
      SELECT AVG(waiting_time_minutes) as avg FROM clients 
      WHERE status IN ('in_service', 'completed') AND DATE(arrival_time) = DATE('now')
    `).first()
    
    return c.json({
      waiting: waiting?.count || 0,
      in_service: inService?.count || 0,
      completed_today: completedToday?.count || 0,
      available_conseillers: availableConseillers?.count || 0,
      avg_waiting_time: Math.round(avgWaitingTime?.avg || 0)
    })
  } catch (error) {
    console.error('Get stats error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Rapports d'activité
app.get('/api/reports', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser || !['chef', 'team_leader'].includes(currentUser.role as string)) {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    const period = c.req.query('period') || 'day' // day, week, month, year
    
    let dateFilter = ''
    switch(period) {
      case 'day':
        dateFilter = "DATE(arrival_time) = DATE('now')"
        break
      case 'week':
        dateFilter = "DATE(arrival_time) >= DATE('now', '-7 days')"
        break
      case 'month':
        dateFilter = "DATE(arrival_time) >= DATE('now', 'start of month')"
        break
      case 'year':
        dateFilter = "DATE(arrival_time) >= DATE('now', 'start of year')"
        break
    }
    
    // Total clients traités
    const totalClients = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM clients 
      WHERE status = 'completed' AND ${dateFilter}
    `).first()
    
    // Par conseiller
    const byConseiller = await c.env.DB.prepare(`
      SELECT 
        u.full_name,
        COUNT(c.id) as clients_served,
        AVG(c.service_time_minutes) as avg_service_time,
        AVG(c.waiting_time_minutes) as avg_waiting_time
      FROM clients c
      INNER JOIN users u ON c.served_by = u.id
      WHERE c.status = 'completed' AND ${dateFilter}
      GROUP BY u.id, u.full_name
      ORDER BY clients_served DESC
    `).all()
    
    // Par type de client
    const byType = await c.env.DB.prepare(`
      SELECT 
        type_client,
        COUNT(*) as count,
        AVG(total_time_minutes) as avg_total_time
      FROM clients
      WHERE status = 'completed' AND ${dateFilter}
      GROUP BY type_client
    `).all()
    
    // Temps moyens globaux
    const avgTimes = await c.env.DB.prepare(`
      SELECT 
        AVG(waiting_time_minutes) as avg_waiting,
        AVG(service_time_minutes) as avg_service,
        AVG(total_time_minutes) as avg_total
      FROM clients
      WHERE status = 'completed' AND ${dateFilter}
    `).first()
    
    return c.json({
      period,
      total_clients: totalClients?.count || 0,
      by_conseiller: byConseiller.results,
      by_type: byType.results,
      avg_times: {
        waiting: Math.round(avgTimes?.avg_waiting || 0),
        service: Math.round(avgTimes?.avg_service || 0),
        total: Math.round(avgTimes?.avg_total || 0)
      }
    })
  } catch (error) {
    console.error('Get reports error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// ============= STATISTIQUES GRAPHIQUES =============

// Statistiques pour graphiques
app.get('/api/statistics/charts', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Non autorisé' }, 401)
    }
    
    const currentUser = await verifySession(c.env.DB, token)
    if (!currentUser || !['chef', 'team_leader'].includes(currentUser.role as string)) {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    const period = c.req.query('period') || 'day'
    
    let dateFilter = ''
    switch(period) {
      case 'day':
        dateFilter = "DATE(arrival_time) = DATE('now')"
        break
      case 'week':
        dateFilter = "DATE(arrival_time) >= DATE('now', '-7 days')"
        break
      case 'month':
        dateFilter = "DATE(arrival_time) >= DATE('now', 'start of month')"
        break
      case 'year':
        dateFilter = "DATE(arrival_time) >= DATE('now', 'start of year')"
        break
    }
    
    // 1. Clients par heure (pour graphique bar)
    const byHour = await c.env.DB.prepare(`
      SELECT 
        CAST(strftime('%H', arrival_time) AS INTEGER) as hour,
        COUNT(*) as count
      FROM clients
      WHERE status = 'completed' AND ${dateFilter}
      GROUP BY hour
      ORDER BY hour
    `).all()
    
    // 2. Performance conseillers (pour graphique bar)
    const conseillerPerf = await c.env.DB.prepare(`
      SELECT 
        u.full_name,
        COUNT(c.id) as clients_count,
        AVG(c.service_time_minutes) as avg_service_time,
        AVG(c.waiting_time_minutes) as avg_waiting_time
      FROM clients c
      INNER JOIN users u ON c.served_by = u.id
      WHERE c.status = 'completed' AND ${dateFilter}
      GROUP BY u.id, u.full_name
      ORDER BY clients_count DESC
      LIMIT 10
    `).all()
    
    // 3. Répartition par type de client (pour pie chart)
    const byClientType = await c.env.DB.prepare(`
      SELECT 
        type_client,
        COUNT(*) as count
      FROM clients
      WHERE status = 'completed' AND ${dateFilter}
      GROUP BY type_client
    `).all()
    
    // 4. Évolution des temps d'attente par jour (pour line chart)
    const waitingTrend = await c.env.DB.prepare(`
      SELECT 
        DATE(arrival_time) as date,
        AVG(waiting_time_minutes) as avg_waiting,
        AVG(service_time_minutes) as avg_service,
        COUNT(*) as count
      FROM clients
      WHERE status = 'completed' AND ${dateFilter}
      GROUP BY date
      ORDER BY date
    `).all()
    
    // 5. Statistiques globales
    const globalStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_clients,
        AVG(waiting_time_minutes) as avg_waiting,
        AVG(service_time_minutes) as avg_service,
        AVG(total_time_minutes) as avg_total,
        MAX(waiting_time_minutes) as max_waiting,
        MIN(waiting_time_minutes) as min_waiting
      FROM clients
      WHERE status = 'completed' AND ${dateFilter}
    `).first()
    
    return c.json({
      period,
      by_hour: byHour.results,
      conseiller_performance: conseillerPerf.results,
      by_client_type: byClientType.results,
      waiting_trend: waitingTrend.results,
      global_stats: globalStats
    })
  } catch (error) {
    console.error('Get statistics error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// ============= GESTION DES PAUSES =============

// Démarrer une pause
app.post('/api/breaks/start', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Non autorisé' }, 401)
  
  try {
    const user = await verifySession(c.env.DB, token)
    if (!user) return c.json({ error: 'Session invalide' }, 401)
    if (user.role !== 'conseiller') return c.json({ error: 'Accès refusé' }, 403)
    
    const { reason } = await c.req.json()
    
    // Vérifier si le conseiller a un client en service
    const clientInService = await c.env.DB.prepare(`
      SELECT id FROM clients WHERE served_by = ? AND status = 'in_service'
    `).bind(user.id).first()
    
    if (clientInService) {
      return c.json({ error: 'Impossible de prendre une pause avec un client en service' }, 400)
    }
    
    // Marquer le conseiller en pause
    const now = new Date().toISOString()
    await c.env.DB.prepare(`
      UPDATE users SET on_break = 1, break_start_time = ?, is_available = 0 WHERE id = ?
    `).bind(now, user.id).run()
    
    // Enregistrer la pause dans l'historique
    await c.env.DB.prepare(`
      INSERT INTO breaks (user_id, break_start, reason) VALUES (?, ?, ?)
    `).bind(user.id, now, reason || '').run()
    
    // Log
    await c.env.DB.prepare(`
      INSERT INTO activity_logs (user_id, action, details) VALUES (?, 'break_start', ?)
    `).bind(user.id, JSON.stringify({ reason })).run()
    
    return c.json({ success: true, break_start: now })
  } catch (error) {
    console.error('Start break error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Terminer une pause
app.post('/api/breaks/end', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Non autorisé' }, 401)
  
  try {
    const user = await verifySession(c.env.DB, token)
    if (!user) return c.json({ error: 'Session invalide' }, 401)
    if (user.role !== 'conseiller') return c.json({ error: 'Accès refusé' }, 403)
    
    // Récupérer l'heure de début de pause
    const userData = await c.env.DB.prepare(`
      SELECT break_start_time, total_break_time_minutes FROM users WHERE id = ?
    `).bind(user.id).first()
    
    if (!userData || !userData.break_start_time) {
      return c.json({ error: 'Aucune pause en cours' }, 400)
    }
    
    const now = new Date().toISOString()
    const breakStart = new Date(userData.break_start_time as string)
    const breakEnd = new Date(now)
    const durationMinutes = Math.floor((breakEnd.getTime() - breakStart.getTime()) / 60000)
    
    // Mettre à jour le conseiller
    const totalBreakTime = (userData.total_break_time_minutes as number || 0) + durationMinutes
    await c.env.DB.prepare(`
      UPDATE users SET on_break = 0, break_start_time = NULL, is_available = 1, total_break_time_minutes = ? WHERE id = ?
    `).bind(totalBreakTime, user.id).run()
    
    // Mettre à jour l'historique de pause
    await c.env.DB.prepare(`
      UPDATE breaks SET break_end = ?, duration_minutes = ? WHERE user_id = ? AND break_end IS NULL
    `).bind(now, durationMinutes, user.id).run()
    
    // Log
    await c.env.DB.prepare(`
      INSERT INTO activity_logs (user_id, action, details) VALUES (?, 'break_end', ?)
    `).bind(user.id, JSON.stringify({ duration_minutes: durationMinutes })).run()
    
    return c.json({ success: true, duration_minutes: durationMinutes })
  } catch (error) {
    console.error('End break error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// Obtenir les pauses d'un conseiller
app.get('/api/breaks/history', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Non autorisé' }, 401)
  
  try {
    const user = await verifySession(c.env.DB, token)
    if (!user) return c.json({ error: 'Session invalide' }, 401)
    
    const userId = c.req.query('user_id') || user.id
    
    // Vérifier les permissions
    if (user.role === 'conseiller' && userId !== user.id.toString()) {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    const breaks = await c.env.DB.prepare(`
      SELECT * FROM breaks WHERE user_id = ? ORDER BY break_start DESC LIMIT 50
    `).bind(userId).all()
    
    return c.json({ breaks: breaks.results })
  } catch (error) {
    console.error('Get breaks error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// ============= SYSTÈME DE TICKETS =============

// Générer un numéro de ticket
async function generateTicketNumber(db: D1Database): Promise<string> {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  
  // Obtenir ou créer le compteur du jour
  let counter = await db.prepare(`
    SELECT counter FROM ticket_counters WHERE date = ?
  `).bind(today).first()
  
  if (!counter) {
    // Créer un nouveau compteur pour aujourd'hui
    await db.prepare(`
      INSERT INTO ticket_counters (date, counter) VALUES (?, 1)
    `).bind(today).run()
    return `${today.replace(/-/g, '')}-001` // Ex: 20260216-001
  }
  
  // Incrémenter le compteur
  const newCounter = (counter.counter as number) + 1
  await db.prepare(`
    UPDATE ticket_counters SET counter = ? WHERE date = ?
  `).bind(newCounter, today).run()
  
  return `${today.replace(/-/g, '')}-${String(newCounter).padStart(3, '0')}`
}

// Générer le contenu QR code (simple texte pour l'instant)
function generateQRCodeData(ticketNumber: string, clientInfo: any): string {
  return JSON.stringify({
    ticket: ticketNumber,
    nom: clientInfo.nom,
    prenom: clientInfo.prenom,
    type: clientInfo.type_client,
    time: new Date().toISOString()
  })
}

// Obtenir le ticket d'un client
app.get('/api/tickets/:clientId', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Non autorisé' }, 401)
  
  try {
    const user = await verifySession(c.env.DB, token)
    if (!user) return c.json({ error: 'Session invalide' }, 401)
    
    const clientId = c.req.param('clientId')
    
    const client = await c.env.DB.prepare(`
      SELECT * FROM clients WHERE id = ?
    `).bind(clientId).first()
    
    if (!client) return c.json({ error: 'Client non trouvé' }, 404)
    
    return c.json({
      ticket_number: client.ticket_number,
      qr_code: client.qr_code,
      client: {
        nom: client.nom,
        prenom: client.prenom,
        type_client: client.type_client,
        arrival_time: client.arrival_time
      }
    })
  } catch (error) {
    console.error('Get ticket error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// ============= STATISTIQUES AVANCÉES =============

// Statistiques avancées avec filtres personnalisés
app.get('/api/statistics/advanced', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Non autorisé' }, 401)
  
  try {
    const user = await verifySession(c.env.DB, token)
    if (!user) return c.json({ error: 'Session invalide' }, 401)
    if (user.role !== 'chef' && user.role !== 'team_leader') {
      return c.json({ error: 'Accès refusé' }, 403)
    }
    
    const startDate = c.req.query('start_date') // YYYY-MM-DD
    const endDate = c.req.query('end_date') // YYYY-MM-DD
    const conseillers = c.req.query('conseillers')?.split(',') // IDs séparés par virgule
    const clientTypes = c.req.query('client_types')?.split(',') // Types séparés par virgule
    
    let dateFilter = "DATE(created_at) >= DATE('now', '-30 days')"
    if (startDate && endDate) {
      dateFilter = `DATE(created_at) BETWEEN '${startDate}' AND '${endDate}'`
    }
    
    let conseillerFilter = ""
    if (conseillers && conseillers.length > 0) {
      conseillerFilter = `AND served_by IN (${conseillers.join(',')})`
    }
    
    let clientTypeFilter = ""
    if (clientTypes && clientTypes.length > 0) {
      const types = clientTypes.map(t => `'${t}'`).join(',')
      clientTypeFilter = `AND type_client IN (${types})`
    }
    
    // Statistiques par jour
    const statsByDay = await c.env.DB.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_clients,
        AVG(waiting_time_minutes) as avg_waiting,
        AVG(service_time_minutes) as avg_service,
        AVG(total_time_minutes) as avg_total,
        MIN(waiting_time_minutes) as min_waiting,
        MAX(waiting_time_minutes) as max_waiting,
        MIN(service_time_minutes) as min_service,
        MAX(service_time_minutes) as max_service
      FROM clients
      WHERE status = 'completed' AND ${dateFilter} ${conseillerFilter} ${clientTypeFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all()
    
    // Comparaison par type de client
    const byClientType = await c.env.DB.prepare(`
      SELECT 
        type_client,
        COUNT(*) as total,
        AVG(waiting_time_minutes) as avg_waiting,
        AVG(service_time_minutes) as avg_service,
        AVG(total_time_minutes) as avg_total
      FROM clients
      WHERE status = 'completed' AND ${dateFilter} ${conseillerFilter} ${clientTypeFilter}
      GROUP BY type_client
    `).all()
    
    // Performance détaillée par conseiller
    const conseillerDetailed = await c.env.DB.prepare(`
      SELECT 
        u.id,
        u.full_name,
        COUNT(c.id) as total_clients,
        AVG(c.waiting_time_minutes) as avg_waiting,
        AVG(c.service_time_minutes) as avg_service,
        AVG(c.total_time_minutes) as avg_total,
        MIN(c.service_time_minutes) as min_service,
        MAX(c.service_time_minutes) as max_service,
        u.total_break_time_minutes,
        SUM(CASE WHEN c.type_client = 'HVC_OR' THEN 1 ELSE 0 END) as vip_count,
        SUM(CASE WHEN c.type_client = 'HVC_ARGENT' THEN 1 ELSE 0 END) as argent_count,
        SUM(CASE WHEN c.type_client = 'HVC_BRONZE' THEN 1 ELSE 0 END) as bronze_count,
        SUM(CASE WHEN c.type_client = 'NON_HVC' THEN 1 ELSE 0 END) as non_hvc_count
      FROM users u
      LEFT JOIN clients c ON c.served_by = u.id AND c.status = 'completed' AND ${dateFilter} ${clientTypeFilter}
      WHERE u.role = 'conseiller' ${conseillers ? `AND u.id IN (${conseillers.join(',')})` : ''}
      GROUP BY u.id
    `).all()
    
    // Temps de pause par conseiller
    const breakStats = await c.env.DB.prepare(`
      SELECT 
        user_id,
        COUNT(*) as total_breaks,
        SUM(duration_minutes) as total_break_minutes,
        AVG(duration_minutes) as avg_break_duration
      FROM breaks
      WHERE ${dateFilter.replace('created_at', 'break_start')}
      ${conseillers ? `AND user_id IN (${conseillers.join(',')})` : ''}
      GROUP BY user_id
    `).all()
    
    return c.json({
      stats_by_day: statsByDay.results,
      by_client_type: byClientType.results,
      conseiller_detailed: conseillerDetailed.results,
      break_stats: breakStats.results,
      filters: {
        start_date: startDate,
        end_date: endDate,
        conseillers,
        client_types: clientTypes
      }
    })
  } catch (error) {
    console.error('Advanced statistics error:', error)
    return c.json({ error: 'Erreur serveur' }, 500)
  }
})

// ============= PAGE PRINCIPALE =============

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="Application de gestion de file d'attente pour agence MTN avec système de priorités VIP">
        <meta name="theme-color" content="#FFC800">
        <title>Gestion de File d'Attente - Agence MTN</title>
        
        <!-- PWA Manifest -->
        <link rel="manifest" href="/manifest.json">
        <link rel="icon" href="/static/icon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/static/icon-192.png">
        
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          /* Mode sombre - Variables CSS */
          :root {
            --bg-primary: #f3f4f6;
            --bg-secondary: #ffffff;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --border-color: #e5e7eb;
          }
          
          [data-theme="dark"] {
            --bg-primary: #1f2937;
            --bg-secondary: #374151;
            --text-primary: #f9fafb;
            --text-secondary: #d1d5db;
            --border-color: #4b5563;
          }
          
          body {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            transition: background-color 0.3s, color 0.3s;
          }
          
          /* Animation de notification */
          @keyframes pulse-notification {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          .notification-badge {
            animation: pulse-notification 2s infinite;
          }
          
          /* Toast notifications */
          .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            animation: slideIn 0.3s ease-out;
          }
          
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/plugin/relativeTime.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/locale/fr.js"></script>
        <!-- Export PDF/Excel/CSV -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
        <!-- QR Code Generator -->
        <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    </head>
    <body class="bg-gray-100">
        <div id="app"></div>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
