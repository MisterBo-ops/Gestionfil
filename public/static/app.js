// Configuration globale
dayjs.extend(dayjs_plugin_relativeTime)
dayjs.locale('fr')

const API_BASE = '/api'
let currentUser = null
let refreshInterval = null

// ============= UTILITAIRES =============

function getToken() {
  return localStorage.getItem('token')
}

function setToken(token) {
  localStorage.setItem('token', token)
}

function clearToken() {
  localStorage.removeItem('token')
}

async function apiCall(endpoint, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  }
  
  const response = await axios({
    url: `${API_BASE}${endpoint}`,
    ...options,
    headers
  })
  
  return response.data
}

function showNotification(message, type = 'info') {
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  }
  
  const notification = document.createElement('div')
  notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in`
  notification.textContent = message
  
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.remove()
  }, 3000)
}

function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}min`
}

function getPriorityBadge(priority, typeClient) {
  const badges = {
    1: { color: 'bg-red-100 text-red-800', icon: 'fa-crown', label: 'VIP - HVC OR' },
    2: { color: 'bg-yellow-100 text-yellow-800', icon: 'fa-star', label: typeClient === 'HVC_BRONZE' ? 'HVC Bronze' : 'HVC Argent' },
    3: { color: 'bg-gray-100 text-gray-800', icon: 'fa-user', label: 'Non-HVC' }
  }
  const badge = badges[priority] || badges[3]
  return `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.color}">
    <i class="fas ${badge.icon} mr-1"></i> ${badge.label}
  </span>`
}

function getStatusBadge(status) {
  const badges = {
    waiting: { color: 'bg-blue-100 text-blue-800', icon: 'fa-clock', label: 'En attente' },
    in_service: { color: 'bg-green-100 text-green-800', icon: 'fa-handshake', label: 'En service' },
    completed: { color: 'bg-gray-100 text-gray-800', icon: 'fa-check-circle', label: 'Terminé' },
    cancelled: { color: 'bg-red-100 text-red-800', icon: 'fa-times-circle', label: 'Annulé' }
  }
  const badge = badges[status] || badges.waiting
  return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}">
    <i class="fas ${badge.icon} mr-1"></i> ${badge.label}
  </span>`
}

// ============= PAGE DE CONNEXION =============

function renderLoginPage() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500">
      <div class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <div class="bg-yellow-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-users text-white text-3xl"></i>
          </div>
          <h1 class="text-3xl font-bold text-gray-800">Gestion de File d'Attente</h1>
          <p class="text-gray-600 mt-2">Agence MTN</p>
        </div>
        
        <form id="loginForm" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-user mr-2"></i>Nom d'utilisateur
            </label>
            <input type="text" id="username" required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-lock mr-2"></i>Mot de passe
            </label>
            <input type="password" id="password" required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent">
          </div>
          
          <button type="submit" 
            class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg transition duration-200 flex items-center justify-center">
            <i class="fas fa-sign-in-alt mr-2"></i>
            Se connecter
          </button>
        </form>
        
        <div class="mt-6 p-4 bg-blue-50 rounded-lg">
          <p class="text-xs text-blue-800 font-semibold mb-2">Comptes de test :</p>
          <p class="text-xs text-blue-700">👑 Chef: <code class="bg-blue-200 px-1 rounded">admin / admin123</code></p>
          <p class="text-xs text-blue-700">⭐ Team Leader: <code class="bg-blue-200 px-1 rounded">teamleader / team123</code></p>
          <p class="text-xs text-blue-700">👤 Conseiller: <code class="bg-blue-200 px-1 rounded">conseiller1 / conseil123</code></p>
        </div>
      </div>
    </div>
  `
  
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const username = document.getElementById('username').value
    const password = document.getElementById('password').value
    
    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        data: { username, password }
      })
      
      setToken(data.token)
      currentUser = data.user
      showNotification('Connexion réussie !', 'success')
      renderMainApp()
    } catch (error) {
      showNotification(error.response?.data?.error || 'Erreur de connexion', 'error')
    }
  })
}

// ============= NAVIGATION =============

function renderNavigation() {
  const roleLabels = {
    chef: 'Chef d\'Agence',
    team_leader: 'Team Leader',
    conseiller: 'Conseiller Client'
  }
  
  return `
    <nav class="bg-white shadow-lg mb-6">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex justify-between items-center py-4">
          <div class="flex items-center space-x-4">
            <div class="bg-yellow-500 w-12 h-12 rounded-full flex items-center justify-center">
              <i class="fas fa-users text-white text-xl"></i>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-800">Gestion de File d'Attente</h1>
              <p class="text-sm text-gray-600">Agence MTN</p>
            </div>
          </div>
          
          <div class="flex items-center space-x-4">
            <div class="text-right">
              <p class="text-sm font-semibold text-gray-800">${currentUser.full_name}</p>
              <p class="text-xs text-gray-600">${roleLabels[currentUser.role]}</p>
            </div>
            <button onclick="logout()" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition">
              <i class="fas fa-sign-out-alt mr-2"></i>Déconnexion
            </button>
          </div>
        </div>
        
        <div class="border-t border-gray-200 -mb-px flex space-x-8" id="tabs">
          ${currentUser.role === 'conseiller' ? `
            <button onclick="switchTab('queue')" data-tab="queue" 
              class="tab-button py-4 px-2 border-b-2 font-medium text-sm">
              <i class="fas fa-list mr-2"></i>File d'attente
            </button>
            <button onclick="switchTab('current')" data-tab="current" 
              class="tab-button py-4 px-2 border-b-2 font-medium text-sm">
              <i class="fas fa-user-clock mr-2"></i>Client actuel
            </button>
          ` : `
            <button onclick="switchTab('dashboard')" data-tab="dashboard" 
              class="tab-button py-4 px-2 border-b-2 font-medium text-sm">
              <i class="fas fa-chart-line mr-2"></i>Tableau de bord
            </button>
            <button onclick="switchTab('queue')" data-tab="queue" 
              class="tab-button py-4 px-2 border-b-2 font-medium text-sm">
              <i class="fas fa-list mr-2"></i>File d'attente
            </button>
            <button onclick="switchTab('conseillers')" data-tab="conseillers" 
              class="tab-button py-4 px-2 border-b-2 font-medium text-sm">
              <i class="fas fa-users-cog mr-2"></i>Gestion Conseillers
            </button>
            <button onclick="switchTab('reports')" data-tab="reports" 
              class="tab-button py-4 px-2 border-b-2 font-medium text-sm">
              <i class="fas fa-file-chart-line mr-2"></i>Rapports
            </button>
          `}
        </div>
      </div>
    </nav>
  `
}

// ============= TABLEAU DE BORD (Chef/Team Leader) =============

async function renderDashboard() {
  try {
    const [stats, agents] = await Promise.all([
      apiCall('/dashboard/stats'),
      apiCall('/dashboard/agents')
    ])
    
    return `
      <div class="space-y-6">
        <!-- Statistiques en temps réel -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">En attente</p>
                <p class="text-3xl font-bold text-blue-600">${stats.waiting}</p>
              </div>
              <div class="bg-blue-100 p-3 rounded-full">
                <i class="fas fa-clock text-blue-600 text-2xl"></i>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">En service</p>
                <p class="text-3xl font-bold text-green-600">${stats.in_service}</p>
              </div>
              <div class="bg-green-100 p-3 rounded-full">
                <i class="fas fa-handshake text-green-600 text-2xl"></i>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">Traités aujourd'hui</p>
                <p class="text-3xl font-bold text-purple-600">${stats.completed_today}</p>
              </div>
              <div class="bg-purple-100 p-3 rounded-full">
                <i class="fas fa-check-circle text-purple-600 text-2xl"></i>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">Conseillers dispo</p>
                <p class="text-3xl font-bold text-yellow-600">${stats.available_conseillers}</p>
              </div>
              <div class="bg-yellow-100 p-3 rounded-full">
                <i class="fas fa-user-check text-yellow-600 text-2xl"></i>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">Temps d'attente moy</p>
                <p class="text-3xl font-bold text-orange-600">${stats.avg_waiting_time}</p>
                <p class="text-xs text-gray-500">minutes</p>
              </div>
              <div class="bg-orange-100 p-3 rounded-full">
                <i class="fas fa-stopwatch text-orange-600 text-2xl"></i>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Agents connectés -->
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-xl font-bold text-gray-800">
              <i class="fas fa-users mr-2"></i>Agents connectés (${agents.agents.length})
            </h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              ${agents.agents.map(agent => `
                <div class="border border-gray-200 rounded-lg p-4 ${agent.is_available === 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center">
                      <div class="${agent.is_available === 1 ? 'bg-green-500' : 'bg-red-500'} w-3 h-3 rounded-full mr-2"></div>
                      <p class="font-semibold text-gray-800">${agent.full_name}</p>
                    </div>
                    <span class="text-xs px-2 py-1 rounded ${agent.role === 'chef' ? 'bg-purple-100 text-purple-800' : agent.role === 'team_leader' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}">
                      ${agent.role === 'chef' ? 'Chef' : agent.role === 'team_leader' ? 'Team Leader' : 'Conseiller'}
                    </span>
                  </div>
                  <p class="text-xs text-gray-600">
                    <i class="fas fa-clock mr-1"></i>Connecté: ${dayjs(agent.login_time).fromNow()}
                  </p>
                  ${agent.current_client_id ? `
                    <div class="mt-2 p-2 bg-white rounded border border-yellow-300">
                      <p class="text-xs font-semibold text-yellow-800">
                        <i class="fas fa-user-clock mr-1"></i>Avec: ${agent.current_client_name}
                      </p>
                    </div>
                  ` : agent.role === 'conseiller' ? `
                    <p class="text-xs text-green-600 mt-2">
                      <i class="fas fa-check mr-1"></i>Disponible
                    </p>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `
  } catch (error) {
    return `<div class="bg-red-100 text-red-800 p-4 rounded-lg">Erreur de chargement</div>`
  }
}

// ============= FILE D'ATTENTE =============

async function renderQueue() {
  try {
    const data = await apiCall('/clients/queue')
    
    // Grouper par priorité
    const vipClients = data.queue.filter(c => c.priority === 1)
    const hvcClients = data.queue.filter(c => c.priority === 2)
    const normalClients = data.queue.filter(c => c.priority === 3)
    
    return `
      <div class="space-y-6">
        <!-- Formulaire d'enregistrement -->
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 bg-yellow-500 rounded-t-lg">
            <h2 class="text-xl font-bold text-white">
              <i class="fas fa-user-plus mr-2"></i>Enregistrer un nouveau client
            </h2>
          </div>
          <form id="registerClientForm" class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Nom *</label>
                <input type="text" id="nom" required 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Prénom *</label>
                <input type="text" id="prenom" required 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Numéro MTN *</label>
                <input type="tel" id="numero_mtn" required placeholder="07xxxxxxxx"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Second contact</label>
                <input type="tel" id="second_contact" placeholder="Facultatif"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Type de client *</label>
                <select id="type_client" required 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500">
                  <option value="">-- Choisir --</option>
                  <option value="HVC_OR">HVC Or (VIP)</option>
                  <option value="HVC_ARGENT">HVC Argent</option>
                  <option value="HVC_BRONZE">HVC Bronze</option>
                  <option value="NON_HVC">Non-HVC</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Raison de la visite *</label>
                <input type="text" id="raison_visite" required placeholder="Ex: Problème de forfait"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500">
              </div>
            </div>
            <div class="mt-4">
              <button type="submit" 
                class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-6 py-3 rounded-lg transition">
                <i class="fas fa-plus mr-2"></i>Enregistrer le client
              </button>
            </div>
          </form>
        </div>
        
        <!-- File d'attente -->
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-xl font-bold text-gray-800">
              <i class="fas fa-list mr-2"></i>File d'attente (${data.queue.length} clients)
            </h2>
          </div>
          
          ${vipClients.length > 0 ? `
            <div class="p-6 border-b border-gray-200 bg-red-50">
              <h3 class="font-bold text-red-800 mb-4">
                <i class="fas fa-crown mr-2"></i>Clients VIP (${vipClients.length})
              </h3>
              <div class="space-y-3">
                ${vipClients.map(client => renderClientCard(client)).join('')}
              </div>
            </div>
          ` : ''}
          
          ${hvcClients.length > 0 ? `
            <div class="p-6 border-b border-gray-200 bg-yellow-50">
              <h3 class="font-bold text-yellow-800 mb-4">
                <i class="fas fa-star mr-2"></i>Clients HVC (${hvcClients.length})
              </h3>
              <div class="space-y-3">
                ${hvcClients.map(client => renderClientCard(client)).join('')}
              </div>
            </div>
          ` : ''}
          
          ${normalClients.length > 0 ? `
            <div class="p-6 bg-gray-50">
              <h3 class="font-bold text-gray-800 mb-4">
                <i class="fas fa-users mr-2"></i>Clients Standard (${normalClients.length})
              </h3>
              <div class="space-y-3">
                ${normalClients.map(client => renderClientCard(client)).join('')}
              </div>
            </div>
          ` : ''}
          
          ${data.queue.length === 0 ? `
            <div class="p-12 text-center text-gray-500">
              <i class="fas fa-inbox text-6xl mb-4"></i>
              <p class="text-lg">Aucun client en attente</p>
            </div>
          ` : ''}
        </div>
      </div>
    `
  } catch (error) {
    return `<div class="bg-red-100 text-red-800 p-4 rounded-lg">Erreur de chargement</div>`
  }
}

function renderClientCard(client) {
  const waitingTime = client.current_waiting_minutes
  const isLongWait = waitingTime > 30 && client.priority === 1
  
  return `
    <div class="bg-white border ${isLongWait ? 'border-red-500 animate-pulse' : 'border-gray-200'} rounded-lg p-4">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center space-x-3 mb-2">
            <h4 class="font-bold text-lg text-gray-800">${client.prenom} ${client.nom}</h4>
            ${getPriorityBadge(client.priority, client.type_client)}
            ${isLongWait ? '<span class="text-xs bg-red-500 text-white px-2 py-1 rounded animate-pulse"><i class="fas fa-exclamation-triangle mr-1"></i>LONGUE ATTENTE</span>' : ''}
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm text-gray-600">
            <p><i class="fas fa-phone mr-2"></i>${client.numero_mtn}</p>
            <p><i class="fas fa-clock mr-2"></i>Attente: <span class="font-bold ${waitingTime > 20 ? 'text-red-600' : 'text-green-600'}">${waitingTime} min</span></p>
            <p><i class="fas fa-clipboard mr-2"></i>${client.raison_visite}</p>
            <p><i class="fas fa-user mr-2"></i>Par: ${client.registered_by_name}</p>
          </div>
        </div>
        
        ${currentUser.role === 'conseiller' && currentUser.is_available === 1 ? `
          <button onclick="callClient(${client.id})" 
            class="ml-4 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition">
            <i class="fas fa-phone mr-2"></i>Appeler
          </button>
        ` : ''}
      </div>
    </div>
  `
}

// ============= CLIENT ACTUEL (Conseiller) =============

async function renderCurrentClient() {
  try {
    const data = await apiCall('/clients/current')
    
    if (!data.client) {
      return `
        <div class="bg-white rounded-lg shadow p-12 text-center">
          <div class="mb-6">
            <i class="fas fa-user-check text-green-500 text-6xl"></i>
          </div>
          <h2 class="text-2xl font-bold text-gray-800 mb-4">Vous êtes disponible</h2>
          <p class="text-gray-600 mb-6">Rendez-vous dans l'onglet "File d'attente" pour appeler un client</p>
          <button onclick="switchTab('queue')" 
            class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-6 py-3 rounded-lg transition">
            <i class="fas fa-list mr-2"></i>Voir la file d'attente
          </button>
        </div>
      `
    }
    
    const client = data.client
    const serviceTime = client.current_service_minutes
    
    return `
      <div class="space-y-6">
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 bg-green-500 rounded-t-lg">
            <h2 class="text-xl font-bold text-white">
              <i class="fas fa-user-clock mr-2"></i>Client en cours de traitement
            </h2>
          </div>
          
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 class="text-sm font-medium text-gray-600 mb-2">Informations client</h3>
                <div class="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p class="text-2xl font-bold text-gray-800">${client.prenom} ${client.nom}</p>
                  ${getPriorityBadge(client.priority, client.type_client)}
                  <div class="pt-3 border-t border-gray-200 space-y-2">
                    <p class="text-sm"><i class="fas fa-phone mr-2 text-gray-500"></i><strong>MTN:</strong> ${client.numero_mtn}</p>
                    ${client.second_contact ? `<p class="text-sm"><i class="fas fa-phone-alt mr-2 text-gray-500"></i><strong>2e contact:</strong> ${client.second_contact}</p>` : ''}
                    <p class="text-sm"><i class="fas fa-clipboard mr-2 text-gray-500"></i><strong>Raison:</strong> ${client.raison_visite}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 class="text-sm font-medium text-gray-600 mb-2">Temps de traitement</h3>
                <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 space-y-4">
                  <div>
                    <p class="text-sm text-gray-600">Temps d'attente</p>
                    <p class="text-3xl font-bold text-green-600">${client.waiting_time_minutes} min</p>
                  </div>
                  <div>
                    <p class="text-sm text-gray-600">Temps de service actuel</p>
                    <p class="text-4xl font-bold text-blue-600">${serviceTime} min</p>
                  </div>
                  <div class="pt-3 border-t border-green-200">
                    <p class="text-xs text-gray-500">Début: ${dayjs(client.service_start_time).format('HH:mm:ss')}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="mt-6">
              <button onclick="completeClient(${client.id})" 
                class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-lg transition text-lg">
                <i class="fas fa-check-circle mr-2"></i>Terminer le service
              </button>
            </div>
          </div>
        </div>
      </div>
    `
  } catch (error) {
    return `<div class="bg-red-100 text-red-800 p-4 rounded-lg">Erreur de chargement</div>`
  }
}

// ============= GESTION CONSEILLERS =============

async function renderConseillers() {
  try {
    const data = await apiCall('/users/conseillers')
    
    return `
      <div class="space-y-6">
        <!-- Formulaire création conseiller -->
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 bg-purple-500 rounded-t-lg">
            <h2 class="text-xl font-bold text-white">
              <i class="fas fa-user-plus mr-2"></i>Créer un nouveau conseiller
            </h2>
          </div>
          <form id="createConseillerForm" class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Nom complet *</label>
                <input type="text" id="conseiller_full_name" required 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Nom d'utilisateur *</label>
                <input type="text" id="conseiller_username" required 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Mot de passe *</label>
                <input type="password" id="conseiller_password" required 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
              </div>
            </div>
            <div class="mt-4">
              <button type="submit" 
                class="bg-purple-500 hover:bg-purple-600 text-white font-bold px-6 py-3 rounded-lg transition">
                <i class="fas fa-plus mr-2"></i>Créer le conseiller
              </button>
            </div>
          </form>
        </div>
        
        <!-- Liste des conseillers -->
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-xl font-bold text-gray-800">
              <i class="fas fa-users mr-2"></i>Liste des conseillers (${data.conseillers.length})
            </h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              ${data.conseillers.map(conseiller => `
                <div class="border ${conseiller.is_active === 1 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'} rounded-lg p-4">
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center">
                      <div class="${conseiller.is_active === 1 ? 'bg-green-500' : 'bg-red-500'} w-3 h-3 rounded-full mr-2"></div>
                      <h3 class="font-bold text-gray-800">${conseiller.full_name}</h3>
                    </div>
                    <span class="text-xs px-2 py-1 rounded ${conseiller.is_active === 1 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}">
                      ${conseiller.is_active === 1 ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <p class="text-sm text-gray-600 mb-3">
                    <i class="fas fa-user mr-2"></i>${conseiller.username}
                  </p>
                  <p class="text-xs text-gray-500 mb-3">
                    <i class="fas fa-calendar mr-2"></i>Créé: ${dayjs(conseiller.created_at).format('DD/MM/YYYY')}
                  </p>
                  <div class="space-y-2">
                    <div class="grid grid-cols-2 gap-2">
                      <button onclick="openEditConseillerModal(${conseiller.id}, '${conseiller.username.replace(/'/g, "\\'")}', '${conseiller.full_name.replace(/'/g, "\\'")}', ${conseiller.is_active})" 
                        class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition text-sm">
                        <i class="fas fa-edit mr-1"></i>Modifier
                      </button>
                      <button onclick="toggleConseiller(${conseiller.id})" 
                        class="${conseiller.is_active === 1 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} text-white px-3 py-2 rounded-lg transition text-sm">
                        <i class="fas fa-${conseiller.is_active === 1 ? 'ban' : 'check'} mr-1"></i>
                        ${conseiller.is_active === 1 ? 'Désactiver' : 'Activer'}
                      </button>
                    </div>
                    <button onclick="deleteConseiller(${conseiller.id}, '${conseiller.full_name.replace(/'/g, "\\'")}', ${conseiller.is_available})" 
                      class="w-full bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition text-sm">
                      <i class="fas fa-trash mr-1"></i>Supprimer
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `
  } catch (error) {
    return `<div class="bg-red-100 text-red-800 p-4 rounded-lg">Erreur de chargement</div>`
  }
}

// ============= RAPPORTS =============

async function renderReports() {
  const period = localStorage.getItem('reportPeriod') || 'day'
  
  try {
    const data = await apiCall(`/reports?period=${period}`)
    
    const periodLabels = {
      day: "Aujourd'hui",
      week: 'Cette semaine',
      month: 'Ce mois',
      year: 'Cette année'
    }
    
    return `
      <div class="space-y-6">
        <!-- Sélecteur de période -->
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-800">
              <i class="fas fa-calendar-alt mr-2"></i>Période: ${periodLabels[period]}
            </h2>
            <div class="flex space-x-2">
              <button onclick="changePeriod('day')" 
                class="px-4 py-2 rounded-lg transition ${period === 'day' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">
                Jour
              </button>
              <button onclick="changePeriod('week')" 
                class="px-4 py-2 rounded-lg transition ${period === 'week' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">
                Semaine
              </button>
              <button onclick="changePeriod('month')" 
                class="px-4 py-2 rounded-lg transition ${period === 'month' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">
                Mois
              </button>
              <button onclick="changePeriod('year')" 
                class="px-4 py-2 rounded-lg transition ${period === 'year' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">
                Année
              </button>
            </div>
          </div>
        </div>
        
        <!-- Statistiques globales -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-600">Total clients traités</p>
            <p class="text-4xl font-bold text-blue-600">${data.total_clients}</p>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-600">Temps d'attente moyen</p>
            <p class="text-4xl font-bold text-orange-600">${data.avg_times.waiting}</p>
            <p class="text-xs text-gray-500">minutes</p>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-600">Temps de service moyen</p>
            <p class="text-4xl font-bold text-green-600">${data.avg_times.service}</p>
            <p class="text-xs text-gray-500">minutes</p>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-600">Temps total moyen</p>
            <p class="text-4xl font-bold text-purple-600">${data.avg_times.total}</p>
            <p class="text-xs text-gray-500">minutes</p>
          </div>
        </div>
        
        <!-- Par conseiller -->
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-xl font-bold text-gray-800">
              <i class="fas fa-user-tie mr-2"></i>Performance par conseiller
            </h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conseiller</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clients servis</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Temps service moy</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Temps attente moy</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                ${data.by_conseiller.map((conseiller, index) => `
                  <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">${conseiller.full_name}</td>
                    <td class="px-6 py-4 text-sm text-gray-700 font-bold">${conseiller.clients_served}</td>
                    <td class="px-6 py-4 text-sm text-gray-700">${Math.round(conseiller.avg_service_time)} min</td>
                    <td class="px-6 py-4 text-sm text-gray-700">${Math.round(conseiller.avg_waiting_time)} min</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Par type de client -->
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-xl font-bold text-gray-800">
              <i class="fas fa-chart-pie mr-2"></i>Répartition par type de client
            </h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              ${data.by_type.map(type => {
                const typeLabels = {
                  HVC_OR: { label: 'HVC Or', color: 'red', icon: 'crown' },
                  HVC_ARGENT: { label: 'HVC Argent', color: 'gray', icon: 'star' },
                  HVC_BRONZE: { label: 'HVC Bronze', color: 'yellow', icon: 'star' },
                  NON_HVC: { label: 'Non-HVC', color: 'blue', icon: 'user' }
                }
                const typeInfo = typeLabels[type.type_client] || typeLabels.NON_HVC
                return `
                  <div class="border border-${typeInfo.color}-200 bg-${typeInfo.color}-50 rounded-lg p-4">
                    <div class="flex items-center mb-2">
                      <i class="fas fa-${typeInfo.icon} text-${typeInfo.color}-600 mr-2"></i>
                      <h3 class="font-bold text-gray-800">${typeInfo.label}</h3>
                    </div>
                    <p class="text-3xl font-bold text-${typeInfo.color}-600">${type.count}</p>
                    <p class="text-xs text-gray-600 mt-1">Temps moyen: ${Math.round(type.avg_total_time)} min</p>
                  </div>
                `
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `
  } catch (error) {
    return `<div class="bg-red-100 text-red-800 p-4 rounded-lg">Erreur de chargement</div>`
  }
}

// ============= ACTIONS =============

async function callClient(clientId) {
  try {
    await apiCall(`/clients/${clientId}/call`, { method: 'POST' })
    showNotification('Client appelé avec succès !', 'success')
    currentUser.is_available = 0
    await switchTab('current')
  } catch (error) {
    showNotification(error.response?.data?.error || 'Erreur', 'error')
  }
}

async function completeClient(clientId) {
  if (!confirm('Êtes-vous sûr d\'avoir terminé avec ce client ?')) return
  
  try {
    const result = await apiCall(`/clients/${clientId}/complete`, { method: 'POST' })
    showNotification(`Service terminé ! Durée: ${result.service_time_minutes} min`, 'success')
    currentUser.is_available = 1
    await switchTab('queue')
  } catch (error) {
    showNotification(error.response?.data?.error || 'Erreur', 'error')
  }
}

async function toggleConseiller(conseillerId) {
  try {
    const result = await apiCall(`/users/conseiller/${conseillerId}/toggle`, { method: 'PATCH' })
    showNotification(result.is_active === 1 ? 'Conseiller activé' : 'Conseiller désactivé', 'success')
    await switchTab('conseillers')
  } catch (error) {
    showNotification(error.response?.data?.error || 'Erreur', 'error')
  }
}

// Ouvrir le modal de modification d'un conseiller
function openEditConseillerModal(id, username, fullName, isActive) {
  const modalHtml = `
    <div id="editConseillerModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="closeEditConseillerModal(event)">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onclick="event.stopPropagation()">
        <div class="px-6 py-4 bg-blue-500 rounded-t-lg">
          <h2 class="text-xl font-bold text-white">
            <i class="fas fa-edit mr-2"></i>Modifier le conseiller
          </h2>
        </div>
        <form id="editConseillerForm" class="p-6">
          <input type="hidden" id="edit_conseiller_id" value="${id}">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Nom complet *</label>
              <input type="text" id="edit_full_name" value="${fullName}" required 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Nom d'utilisateur *</label>
              <input type="text" id="edit_username" value="${username}" required 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Nouveau mot de passe <span class="text-xs text-gray-500">(laisser vide pour ne pas modifier)</span>
              </label>
              <input type="password" id="edit_password" 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
          </div>
          <div class="mt-6 flex space-x-3">
            <button type="submit" 
              class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition">
              <i class="fas fa-save mr-2"></i>Enregistrer
            </button>
            <button type="button" onclick="closeEditConseillerModal()" 
              class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition">
              <i class="fas fa-times mr-2"></i>Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  `
  
  document.body.insertAdjacentHTML('beforeend', modalHtml)
  
  // Ajouter l'event listener pour le formulaire
  document.getElementById('editConseillerForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    await updateConseiller()
  })
}

// Fermer le modal de modification
function closeEditConseillerModal(event) {
  if (!event || event.target.id === 'editConseillerModal') {
    const modal = document.getElementById('editConseillerModal')
    if (modal) {
      modal.remove()
    }
  }
}

// Mettre à jour un conseiller
async function updateConseiller() {
  try {
    const id = document.getElementById('edit_conseiller_id').value
    const data = {
      full_name: document.getElementById('edit_full_name').value,
      username: document.getElementById('edit_username').value
    }
    
    const password = document.getElementById('edit_password').value
    if (password) {
      data.password = password
    }
    
    await apiCall(`/users/conseiller/${id}`, { method: 'PATCH', data })
    showNotification('Conseiller modifié avec succès !', 'success')
    closeEditConseillerModal()
    await switchTab('conseillers')
  } catch (error) {
    showNotification(error.response?.data?.error || 'Erreur', 'error')
  }
}

// Supprimer un conseiller
async function deleteConseiller(conseillerId, fullName, isAvailable) {
  // Vérifier si le conseiller est occupé
  if (isAvailable === 0) {
    showNotification('Impossible de supprimer: le conseiller a un client en cours', 'warning')
    return
  }
  
  const confirmed = confirm(
    `⚠️ ATTENTION: Êtes-vous sûr de vouloir supprimer le conseiller "${fullName}" ?\n\n` +
    `Cette action est IRRÉVERSIBLE et supprimera:\n` +
    `- Le compte du conseiller\n` +
    `- Toutes ses sessions\n` +
    `- Son historique restera dans les logs\n\n` +
    `Tapez OK pour confirmer la suppression.`
  )
  
  if (!confirmed) return
  
  try {
    await apiCall(`/users/conseiller/${conseillerId}`, { method: 'DELETE' })
    showNotification('Conseiller supprimé avec succès', 'success')
    await switchTab('conseillers')
  } catch (error) {
    showNotification(error.response?.data?.error || 'Erreur', 'error')
  }
}

function changePeriod(period) {
  localStorage.setItem('reportPeriod', period)
  switchTab('reports')
}

async function logout() {
  try {
    await apiCall('/auth/logout', { method: 'POST' })
  } catch (error) {
    // Ignorer les erreurs de logout
  }
  
  clearToken()
  currentUser = null
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  showNotification('Déconnexion réussie', 'success')
  renderLoginPage()
}

// ============= GESTION DES ONGLETS =============

async function switchTab(tabName) {
  // Mettre à jour les boutons
  document.querySelectorAll('.tab-button').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('border-yellow-500', 'text-yellow-600')
      btn.classList.remove('border-transparent', 'text-gray-500')
    } else {
      btn.classList.remove('border-yellow-500', 'text-yellow-600')
      btn.classList.add('border-transparent', 'text-gray-500')
    }
  })
  
  // Charger le contenu
  const content = document.getElementById('content')
  content.innerHTML = '<div class="text-center py-12"><i class="fas fa-spinner fa-spin text-4xl text-yellow-500"></i></div>'
  
  let html = ''
  switch(tabName) {
    case 'dashboard':
      html = await renderDashboard()
      break
    case 'queue':
      html = await renderQueue()
      break
    case 'current':
      html = await renderCurrentClient()
      break
    case 'conseillers':
      html = await renderConseillers()
      break
    case 'reports':
      html = await renderReports()
      break
  }
  
  content.innerHTML = html
  
  // Ajouter les event listeners
  attachEventListeners()
}

function attachEventListeners() {
  // Formulaire enregistrement client
  const registerForm = document.getElementById('registerClientForm')
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const data = {
        nom: document.getElementById('nom').value,
        prenom: document.getElementById('prenom').value,
        numero_mtn: document.getElementById('numero_mtn').value,
        second_contact: document.getElementById('second_contact').value || null,
        raison_visite: document.getElementById('raison_visite').value,
        type_client: document.getElementById('type_client').value
      }
      
      try {
        await apiCall('/clients', { method: 'POST', data })
        showNotification('Client enregistré avec succès !', 'success')
        registerForm.reset()
        await switchTab('queue')
      } catch (error) {
        showNotification(error.response?.data?.error || 'Erreur', 'error')
      }
    })
  }
  
  // Formulaire création conseiller
  const createForm = document.getElementById('createConseillerForm')
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const data = {
        full_name: document.getElementById('conseiller_full_name').value,
        username: document.getElementById('conseiller_username').value,
        password: document.getElementById('conseiller_password').value
      }
      
      try {
        await apiCall('/users/conseiller', { method: 'POST', data })
        showNotification('Conseiller créé avec succès !', 'success')
        createForm.reset()
        await switchTab('conseillers')
      } catch (error) {
        showNotification(error.response?.data?.error || 'Erreur', 'error')
      }
    })
  }
}

// ============= APPLICATION PRINCIPALE =============

async function renderMainApp() {
  const app = document.getElementById('app')
  
  app.innerHTML = `
    <div class="min-h-screen bg-gray-100">
      ${renderNavigation()}
      <div class="max-w-7xl mx-auto px-4 pb-8">
        <div id="content"></div>
      </div>
    </div>
  `
  
  // Charger l'onglet par défaut
  const defaultTab = currentUser.role === 'conseiller' ? 'queue' : 'dashboard'
  await switchTab(defaultTab)
  
  // Auto-refresh toutes les 30 secondes
  refreshInterval = setInterval(async () => {
    const activeTab = document.querySelector('.tab-button.border-yellow-500')?.dataset.tab
    if (activeTab) {
      const content = document.getElementById('content')
      let html = ''
      
      try {
        switch(activeTab) {
          case 'dashboard':
            html = await renderDashboard()
            break
          case 'queue':
            html = await renderQueue()
            break
          case 'current':
            html = await renderCurrentClient()
            break
        }
        
        if (html) {
          content.innerHTML = html
          attachEventListeners()
        }
      } catch (error) {
        console.error('Auto-refresh error:', error)
      }
    }
  }, 30000)
}

// ============= INITIALISATION =============

async function init() {
  const token = getToken()
  if (!token) {
    renderLoginPage()
    return
  }
  
  try {
    const user = await apiCall('/auth/me')
    currentUser = user
    renderMainApp()
  } catch (error) {
    clearToken()
    renderLoginPage()
  }
}

// Démarrer l'application
init()

// Exposer les fonctions globales
window.switchTab = switchTab
window.callClient = callClient
window.completeClient = completeClient
window.toggleConseiller = toggleConseiller
window.openEditConseillerModal = openEditConseillerModal
window.closeEditConseillerModal = closeEditConseillerModal
window.updateConseiller = updateConseiller
window.deleteConseiller = deleteConseiller
window.changePeriod = changePeriod
window.logout = logout
