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
            <button onclick="switchTab('statistics')" data-tab="statistics" 
              class="tab-button py-4 px-2 border-b-2 font-medium text-sm">
              <i class="fas fa-chart-bar mr-2"></i>Statistiques
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
        <!-- Sélecteur de période et boutons d'export -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div class="flex items-center justify-between flex-wrap gap-4">
            <h2 class="text-xl font-bold text-gray-800 dark:text-gray-200">
              <i class="fas fa-calendar-alt mr-2"></i>Période: ${periodLabels[period]}
            </h2>
            <div class="flex space-x-2 flex-wrap gap-2">
              <!-- Sélecteur de période -->
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
              
              <!-- Séparateur -->
              <div class="border-l border-gray-300 dark:border-gray-600 mx-2"></div>
              
              <!-- Boutons d'export -->
              <button onclick="exportReportToPDF()" 
                class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center space-x-2">
                <i class="fas fa-file-pdf"></i>
                <span>PDF</span>
              </button>
              <button onclick="exportReportToExcel()" 
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center space-x-2">
                <i class="fas fa-file-excel"></i>
                <span>Excel</span>
              </button>
              <button onclick="exportReportToCSV()" 
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2">
                <i class="fas fa-file-csv"></i>
                <span>CSV</span>
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

// ============= STATISTIQUES GRAPHIQUES =============

let chartsInstances = {} // Stocker les instances de graphiques pour les détruire lors du changement

async function renderStatistics() {
  const period = localStorage.getItem('statisticsPeriod') || 'week'
  
  try {
    const data = await apiCall(`/statistics/charts?period=${period}`)
    
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
              <i class="fas fa-chart-bar mr-2"></i>Statistiques Visuelles - ${periodLabels[period]}
            </h2>
            <div class="flex space-x-2">
              <button onclick="changeStatsPeriod('day')" 
                class="px-4 py-2 rounded-lg transition ${period === 'day' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">
                Jour
              </button>
              <button onclick="changeStatsPeriod('week')" 
                class="px-4 py-2 rounded-lg transition ${period === 'week' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">
                Semaine
              </button>
              <button onclick="changeStatsPeriod('month')" 
                class="px-4 py-2 rounded-lg transition ${period === 'month' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">
                Mois
              </button>
              <button onclick="changeStatsPeriod('year')" 
                class="px-4 py-2 rounded-lg transition ${period === 'year' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">
                Année
              </button>
            </div>
          </div>
        </div>
        
        <!-- Statistiques globales en cartes -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm opacity-90">Total Clients</p>
                <p class="text-4xl font-bold">${data.global_stats?.total_clients || 0}</p>
              </div>
              <i class="fas fa-users text-5xl opacity-20"></i>
            </div>
          </div>
          
          <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm opacity-90">Temps Attente Moy</p>
                <p class="text-4xl font-bold">${Math.round(data.global_stats?.avg_waiting || 0)}<span class="text-lg">min</span></p>
              </div>
              <i class="fas fa-clock text-5xl opacity-20"></i>
            </div>
          </div>
          
          <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm opacity-90">Temps Service Moy</p>
                <p class="text-4xl font-bold">${Math.round(data.global_stats?.avg_service || 0)}<span class="text-lg">min</span></p>
              </div>
              <i class="fas fa-hourglass-half text-5xl opacity-20"></i>
            </div>
          </div>
          
          <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm opacity-90">Temps Total Moy</p>
                <p class="text-4xl font-bold">${Math.round(data.global_stats?.avg_total || 0)}<span class="text-lg">min</span></p>
              </div>
              <i class="fas fa-stopwatch text-5xl opacity-20"></i>
            </div>
          </div>
        </div>
        
        <!-- Graphiques -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Graphique 1: Performance des conseillers -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">
              <i class="fas fa-user-tie text-blue-500 mr-2"></i>Performance des Conseillers
            </h3>
            <canvas id="conseillerPerfChart"></canvas>
          </div>
          
          <!-- Graphique 2: Répartition par type de client -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">
              <i class="fas fa-pie-chart text-green-500 mr-2"></i>Répartition par Type de Client
            </h3>
            <canvas id="clientTypeChart"></canvas>
          </div>
          
          <!-- Graphique 3: Affluence par heure -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">
              <i class="fas fa-chart-area text-purple-500 mr-2"></i>Affluence par Heure
            </h3>
            <canvas id="hourlyChart"></canvas>
          </div>
          
          <!-- Graphique 4: Évolution des temps d'attente -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">
              <i class="fas fa-chart-line text-orange-500 mr-2"></i>Évolution des Temps
            </h3>
            <canvas id="waitingTrendChart"></canvas>
          </div>
        </div>
      </div>
    `
  } catch (error) {
    console.error('Statistics error:', error)
    return `<div class="bg-red-100 text-red-800 p-4 rounded-lg">Erreur de chargement des statistiques</div>`
  }
}

// Fonction pour initialiser les graphiques Chart.js
async function initializeCharts() {
  const period = localStorage.getItem('statisticsPeriod') || 'week'
  
  try {
    const data = await apiCall(`/statistics/charts?period=${period}`)
    
    // Détruire les anciens graphiques s'ils existent
    Object.values(chartsInstances).forEach(chart => chart && chart.destroy())
    chartsInstances = {}
    
    // 1. Graphique Performance Conseillers (Bar Chart)
    const conseillerCtx = document.getElementById('conseillerPerfChart')
    if (conseillerCtx) {
      chartsInstances.conseiller = new Chart(conseillerCtx, {
        type: 'bar',
        data: {
          labels: data.conseiller_performance.map(c => c.full_name),
          datasets: [{
            label: 'Clients Servis',
            data: data.conseiller_performance.map(c => c.clients_count),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: true },
            title: { display: false }
          },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      })
    }
    
    // 2. Graphique Type de Client (Pie Chart)
    const clientTypeCtx = document.getElementById('clientTypeChart')
    if (clientTypeCtx) {
      const typeLabels = {
        'HVC_OR': 'HVC Or (VIP)',
        'HVC_ARGENT': 'HVC Argent',
        'HVC_BRONZE': 'HVC Bronze',
        'NON_HVC': 'Non-HVC'
      }
      
      chartsInstances.clientType = new Chart(clientTypeCtx, {
        type: 'pie',
        data: {
          labels: data.by_client_type.map(t => typeLabels[t.type_client] || t.type_client),
          datasets: [{
            data: data.by_client_type.map(t => t.count),
            backgroundColor: [
              'rgba(239, 68, 68, 0.8)',   // Rouge pour VIP
              'rgba(156, 163, 175, 0.8)', // Gris pour Argent
              'rgba(251, 191, 36, 0.8)',  // Jaune pour Bronze
              'rgba(59, 130, 246, 0.8)'   // Bleu pour Non-HVC
            ],
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'right' }
          }
        }
      })
    }
    
    // 3. Graphique Affluence par Heure (Bar Chart)
    const hourlyCtx = document.getElementById('hourlyChart')
    if (hourlyCtx) {
      // Créer un tableau de 24 heures
      const hourlyData = Array(24).fill(0)
      data.by_hour.forEach(h => {
        hourlyData[h.hour] = h.count
      })
      
      chartsInstances.hourly = new Chart(hourlyCtx, {
        type: 'bar',
        data: {
          labels: Array.from({length: 24}, (_, i) => `${i}h`),
          datasets: [{
            label: 'Nombre de Clients',
            data: hourlyData,
            backgroundColor: 'rgba(139, 92, 246, 0.8)',
            borderColor: 'rgb(139, 92, 246)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: true }
          },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      })
    }
    
    // 4. Graphique Évolution Temps (Line Chart)
    const waitingTrendCtx = document.getElementById('waitingTrendChart')
    if (waitingTrendCtx) {
      chartsInstances.waitingTrend = new Chart(waitingTrendCtx, {
        type: 'line',
        data: {
          labels: data.waiting_trend.map(d => dayjs(d.date).format('DD/MM')),
          datasets: [
            {
              label: 'Temps d\'Attente (min)',
              data: data.waiting_trend.map(d => Math.round(d.avg_waiting)),
              borderColor: 'rgb(249, 115, 22)',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Temps de Service (min)',
              data: data.waiting_trend.map(d => Math.round(d.avg_service)),
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: true, position: 'top' }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      })
    }
    
  } catch (error) {
    console.error('Chart initialization error:', error)
  }
}

function changeStatsPeriod(period) {
  localStorage.setItem('statisticsPeriod', period)
  switchTab('statistics')
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
    case 'statistics':
      html = await renderStatistics()
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
  
  // Initialiser les graphiques Chart.js si on est sur l'onglet statistiques
  if (tabName === 'statistics') {
    setTimeout(() => initializeCharts(), 100)
  }
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
  // Initialiser le mode sombre
  initDarkMode()
  
  // Initialiser les sons
  try {
    initSounds()
  } catch (error) {
    console.log('Audio init skipped:', error)
  }
  
  const token = getToken()
  if (!token) {
    renderLoginPage()
    return
  }
  
  try {
    const user = await apiCall('/auth/me')
    currentUser = user
    renderMainApp()
    
    // Ajouter le bouton de toggle du thème et le sélecteur de langue
    setTimeout(() => {
      addThemeToggle()
      addLanguageSelector()
    }, 100)
    
    // Démarrer le monitoring VIP si c'est un chef ou team leader
    if (user.role === 'chef' || user.role === 'team_leader') {
      startVIPMonitoring()
      // Première vérification immédiate
      setTimeout(checkVIPWaitingTime, 5000)
    }
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

// ============= EXPORT PDF/EXCEL/CSV =============

async function exportReportToPDF() {
  try {
    const period = localStorage.getItem('reportPeriod') || 'day'
    const data = await apiCall(`/reports?period=${period}`)
    
    const { jsPDF } = window.jspdf
    const doc = new jsPDF()
    
    const periodLabels = {
      day: "Aujourd'hui",
      week: 'Cette semaine',
      month: 'Ce mois',
      year: 'Cette année'
    }
    
    // En-tête
    doc.setFontSize(20)
    doc.setTextColor(255, 200, 0) // Jaune MTN
    doc.text('MTN - Rapport d\'Activité', 105, 20, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text(`Période: ${periodLabels[period]}`, 105, 30, { align: 'center' })
    doc.text(`Date: ${dayjs().format('DD/MM/YYYY HH:mm')}`, 105, 37, { align: 'center' })
    
    // Statistiques globales
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text('Statistiques Globales', 14, 50)
    
    doc.autoTable({
      startY: 55,
      head: [['Métrique', 'Valeur']],
      body: [
        ['Total clients traités', data.total_clients.toString()],
        ['Temps d\'attente moyen', `${data.avg_times.waiting} minutes`],
        ['Temps de service moyen', `${data.avg_times.service} minutes`],
        ['Temps total moyen', `${data.avg_times.total} minutes`]
      ],
      theme: 'striped',
      headStyles: { fillColor: [255, 200, 0], textColor: [0, 0, 0] }
    })
    
    // Performance par conseiller
    let finalY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(14)
    doc.text('Performance par Conseiller', 14, finalY)
    
    doc.autoTable({
      startY: finalY + 5,
      head: [['Conseiller', 'Clients Servis', 'Temps Service Moy', 'Temps Attente Moy']],
      body: data.by_conseiller.map(c => [
        c.full_name,
        c.clients_served.toString(),
        `${Math.round(c.avg_service_time)} min`,
        `${Math.round(c.avg_waiting_time)} min`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [255, 200, 0], textColor: [0, 0, 0] }
    })
    
    // Répartition par type de client
    finalY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(14)
    doc.text('Répartition par Type de Client', 14, finalY)
    
    const typeLabels = {
      HVC_OR: 'HVC Or (VIP)',
      HVC_ARGENT: 'HVC Argent',
      HVC_BRONZE: 'HVC Bronze',
      NON_HVC: 'Non-HVC'
    }
    
    doc.autoTable({
      startY: finalY + 5,
      head: [['Type Client', 'Nombre', 'Temps Moyen']],
      body: data.by_type.map(t => [
        typeLabels[t.type_client] || t.type_client,
        t.count.toString(),
        `${Math.round(t.avg_total_time)} min`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [255, 200, 0], textColor: [0, 0, 0] }
    })
    
    // Pied de page
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(10)
      doc.setTextColor(128, 128, 128)
      doc.text(
        `Page ${i} sur ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }
    
    // Télécharger
    const filename = `rapport_mtn_${period}_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`
    doc.save(filename)
    
    showNotification('Rapport PDF téléchargé avec succès !', 'success')
  } catch (error) {
    console.error('Export PDF error:', error)
    showNotification('Erreur lors de l\'export PDF', 'error')
  }
}

async function exportReportToExcel() {
  try {
    const period = localStorage.getItem('reportPeriod') || 'day'
    const data = await apiCall(`/reports?period=${period}`)
    
    const periodLabels = {
      day: "Aujourd'hui",
      week: 'Cette semaine',
      month: 'Ce mois',
      year: 'Cette année'
    }
    
    const wb = XLSX.utils.book_new()
    
    // Feuille 1: Statistiques globales
    const globalData = [
      ['MTN - Rapport d\'Activité'],
      [`Période: ${periodLabels[period]}`],
      [`Date: ${dayjs().format('DD/MM/YYYY HH:mm')}`],
      [],
      ['Statistiques Globales'],
      ['Métrique', 'Valeur'],
      ['Total clients traités', data.total_clients],
      ['Temps d\'attente moyen (min)', data.avg_times.waiting],
      ['Temps de service moyen (min)', data.avg_times.service],
      ['Temps total moyen (min)', data.avg_times.total]
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(globalData)
    XLSX.utils.book_append_sheet(wb, ws1, 'Statistiques')
    
    // Feuille 2: Performance conseillers
    const conseillerData = [
      ['Performance par Conseiller'],
      [],
      ['Conseiller', 'Clients Servis', 'Temps Service Moy (min)', 'Temps Attente Moy (min)'],
      ...data.by_conseiller.map(c => [
        c.full_name,
        c.clients_served,
        Math.round(c.avg_service_time),
        Math.round(c.avg_waiting_time)
      ])
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(conseillerData)
    XLSX.utils.book_append_sheet(wb, ws2, 'Conseillers')
    
    // Feuille 3: Types de clients
    const typeLabels = {
      HVC_OR: 'HVC Or (VIP)',
      HVC_ARGENT: 'HVC Argent',
      HVC_BRONZE: 'HVC Bronze',
      NON_HVC: 'Non-HVC'
    }
    
    const typeData = [
      ['Répartition par Type de Client'],
      [],
      ['Type Client', 'Nombre', 'Temps Moyen (min)'],
      ...data.by_type.map(t => [
        typeLabels[t.type_client] || t.type_client,
        t.count,
        Math.round(t.avg_total_time)
      ])
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(typeData)
    XLSX.utils.book_append_sheet(wb, ws3, 'Types Clients')
    
    // Télécharger
    const filename = `rapport_mtn_${period}_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
    XLSX.writeFile(wb, filename)
    
    showNotification('Rapport Excel téléchargé avec succès !', 'success')
  } catch (error) {
    console.error('Export Excel error:', error)
    showNotification('Erreur lors de l\'export Excel', 'error')
  }
}

async function exportReportToCSV() {
  try {
    const period = localStorage.getItem('reportPeriod') || 'day'
    const data = await apiCall(`/reports?period=${period}`)
    
    // Créer les données CSV pour les conseillers
    let csv = 'Conseiller,Clients Servis,Temps Service Moyen (min),Temps Attente Moyen (min)\n'
    data.by_conseiller.forEach(c => {
      csv += `"${c.full_name}",${c.clients_served},${Math.round(c.avg_service_time)},${Math.round(c.avg_waiting_time)}\n`
    })
    
    // Télécharger
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `rapport_mtn_${period}_${dayjs().format('YYYYMMDD_HHmmss')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    showNotification('Rapport CSV téléchargé avec succès !', 'success')
  } catch (error) {
    console.error('Export CSV error:', error)
    showNotification('Erreur lors de l\'export CSV', 'error')
  }
}


// ============= NOTIFICATIONS & ALERTES =============

let notificationSound = null
let vipAlertSound = null

// Charger les sons (sons par défaut du navigateur ou via API Web Audio)
function initSounds() {
  // Son simple pour notifications standard
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  
  // Créer un son de notification simple
  window.playNotificationSound = function() {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  }
  
  // Son d'alerte VIP (plus urgent)
  window.playVIPAlert = function() {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 1200
    oscillator.type = 'square'
    
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
    
    // Double beep
    setTimeout(() => {
      const osc2 = audioContext.createOscillator()
      const gain2 = audioContext.createGain()
      osc2.connect(gain2)
      gain2.connect(audioContext.destination)
      osc2.frequency.value = 1200
      osc2.type = 'square'
      gain2.gain.setValueAtTime(0.4, audioContext.currentTime)
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      osc2.start(audioContext.currentTime)
      osc2.stop(audioContext.currentTime + 0.3)
    }, 400)
  }
}

// Afficher une toast notification
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div')
  toast.className = `toast ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'} text-white px-6 py-4 rounded-lg shadow-lg`
  
  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ'
  
  toast.innerHTML = `
    <div class="flex items-center space-x-3">
      <span class="text-2xl">${icon}</span>
      <span class="font-medium">${message}</span>
    </div>
  `
  
  document.body.appendChild(toast)
  
  // Jouer un son selon le type
  if (type === 'warning' && window.playVIPAlert) {
    window.playVIPAlert()
  } else if (window.playNotificationSound) {
    window.playNotificationSound()
  }
  
  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateX(100%)'
    setTimeout(() => toast.remove(), 300)
  }, duration)
}

// Système de notifications pour clients en attente
let lastVIPAlertTime = {}

async function checkVIPWaitingTime() {
  try {
    const queue = await apiCall('/clients/queue')
    
    queue.forEach(client => {
      if (client.type_client === 'HVC_OR' && client.waiting_minutes > 30) {
        const alertKey = `vip_${client.id}`
        const now = Date.now()
        
        // Alerter toutes les 5 minutes pour un même client VIP
        if (!lastVIPAlertTime[alertKey] || (now - lastVIPAlertTime[alertKey]) > 5 * 60 * 1000) {
          showToast(
            `⚠️ CLIENT VIP EN ATTENTE : ${client.prenom} ${client.nom} attend depuis ${client.waiting_minutes} minutes !`,
            'warning',
            5000
          )
          lastVIPAlertTime[alertKey] = now
        }
      }
    })
  } catch (error) {
    console.error('VIP check error:', error)
  }
}

// Vérifier les VIP toutes les 2 minutes
let vipCheckInterval = null

function startVIPMonitoring() {
  if (vipCheckInterval) clearInterval(vipCheckInterval)
  vipCheckInterval = setInterval(checkVIPWaitingTime, 2 * 60 * 1000) // Toutes les 2 minutes
}

function stopVIPMonitoring() {
  if (vipCheckInterval) {
    clearInterval(vipCheckInterval)
    vipCheckInterval = null
  }
}

// ============= MODE SOMBRE =============

function initDarkMode() {
  // Récupérer la préférence sauvegardée
  const savedTheme = localStorage.getItem('theme') || 'light'
  applyTheme(savedTheme)
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.body.classList.add('dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
    document.body.classList.remove('dark')
  }
  localStorage.setItem('theme', theme)
  
  // Mettre à jour l'icône du bouton toggle
  updateThemeToggleIcon(theme)
}

function toggleDarkMode() {
  const currentTheme = localStorage.getItem('theme') || 'light'
  const newTheme = currentTheme === 'light' ? 'dark' : 'light'
  applyTheme(newTheme)
}

function updateThemeToggleIcon(theme) {
  const toggleBtn = document.getElementById('theme-toggle')
  if (toggleBtn) {
    const icon = toggleBtn.querySelector('i')
    if (icon) {
      icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon'
    }
  }
}

// Ajouter le bouton toggle dans la navigation
function addThemeToggle() {
  const nav = document.querySelector('nav .flex.items-center.justify-between')
  if (nav && !document.getElementById('theme-toggle')) {
    const themeToggle = document.createElement('button')
    themeToggle.id = 'theme-toggle'
    themeToggle.className = 'ml-4 p-2 rounded-lg hover:bg-yellow-500 hover:bg-opacity-20 transition'
    themeToggle.onclick = toggleDarkMode
    
    const currentTheme = localStorage.getItem('theme') || 'light'
    themeToggle.innerHTML = `<i class="fas fa-${currentTheme === 'dark' ? 'sun' : 'moon'} text-yellow-500"></i>`
    
    nav.appendChild(themeToggle)
  }
}

// Ajouter le sélecteur de langue dans la navigation
function addLanguageSelector() {
  const nav = document.querySelector('nav .flex.items-center.justify-between')
  if (nav && !document.getElementById('language-selector')) {
    const langSelector = document.createElement('div')
    langSelector.id = 'language-selector'
    langSelector.className = 'language-selector ml-4'
    
    const currentLang = localStorage.getItem('language') || 'fr'
    langSelector.innerHTML = `
      <i class="fas fa-globe"></i>
      <select onchange="changeLanguage(this.value)" class="bg-transparent border-none text-sm font-medium cursor-pointer focus:outline-none">
        <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>FR</option>
        <option value="en" ${currentLang === 'en' ? 'selected' : ''}>EN</option>
      </select>
    `
    
    nav.appendChild(langSelector)
  }
}


// ============= PWA SERVICE WORKER =============

// Enregistrer le Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker enregistré:', registration.scope)
        
        // Vérifier les mises à jour
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nouvelle version disponible
              showToast('Nouvelle version disponible ! Rechargez la page.', 'info', 5000)
            }
          })
        })
      })
      .catch((error) => {
        console.log('❌ Erreur Service Worker:', error)
      })
  })
}

// Prompt d'installation PWA
let deferredPrompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  
  // Afficher un message d'installation après 30 secondes
  setTimeout(() => {
    if (deferredPrompt) {
      showToast('💡 Installez l\'app pour un accès rapide !', 'info', 10000)
    }
  }, 30000)
})

window.addEventListener('appinstalled', () => {
  console.log('✅ PWA installée')
  showToast('✅ Application installée avec succès !', 'success')
  deferredPrompt = null
})

// ============= SYSTÈME MULTILINGUE (i18n) =============

const translations = {
  fr: {
    // Navigation
    'nav.dashboard': 'Tableau de bord',
    'nav.statistics': 'Statistiques',
    'nav.queue': 'File d\'attente',
    'nav.advisors': 'Gestion Conseillers',
    'nav.reports': 'Rapports',
    'nav.current_client': 'Client actuel',
    'nav.logout': 'Déconnexion',
    
    // Login
    'login.title': 'Connexion',
    'login.username': 'Nom d\'utilisateur',
    'login.password': 'Mot de passe',
    'login.button': 'Se connecter',
    'login.error': 'Identifiants invalides',
    
    // Dashboard
    'dashboard.title': 'Tableau de Bord',
    'dashboard.waiting': 'En attente',
    'dashboard.in_service': 'En service',
    'dashboard.completed': 'Traités aujourd\'hui',
    'dashboard.available': 'Conseillers disponibles',
    'dashboard.avg_waiting': 'Temps d\'attente moyen',
    
    // Queue
    'queue.title': 'File d\'Attente',
    'queue.priority': 'Priorité',
    'queue.name': 'Nom',
    'queue.phone': 'Téléphone',
    'queue.waiting_time': 'Temps d\'attente',
    'queue.reason': 'Raison',
    'queue.call': 'Appeler',
    
    // Reports
    'reports.title': 'Rapports d\'Activité',
    'reports.period': 'Période',
    'reports.day': 'Jour',
    'reports.week': 'Semaine',
    'reports.month': 'Mois',
    'reports.year': 'Année',
    'reports.export_pdf': 'Exporter PDF',
    'reports.export_excel': 'Exporter Excel',
    'reports.export_csv': 'Exporter CSV',
    
    // Common
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.close': 'Fermer',
    'common.search': 'Rechercher',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    'common.minutes': 'minutes'
  },
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.statistics': 'Statistics',
    'nav.queue': 'Queue',
    'nav.advisors': 'Advisor Management',
    'nav.reports': 'Reports',
    'nav.current_client': 'Current Client',
    'nav.logout': 'Logout',
    
    // Login
    'login.title': 'Login',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.button': 'Sign in',
    'login.error': 'Invalid credentials',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.waiting': 'Waiting',
    'dashboard.in_service': 'In Service',
    'dashboard.completed': 'Completed Today',
    'dashboard.available': 'Available Advisors',
    'dashboard.avg_waiting': 'Average Wait Time',
    
    // Queue
    'queue.title': 'Queue',
    'queue.priority': 'Priority',
    'queue.name': 'Name',
    'queue.phone': 'Phone',
    'queue.waiting_time': 'Wait Time',
    'queue.reason': 'Reason',
    'queue.call': 'Call',
    
    // Reports
    'reports.title': 'Activity Reports',
    'reports.period': 'Period',
    'reports.day': 'Day',
    'reports.week': 'Week',
    'reports.month': 'Month',
    'reports.year': 'Year',
    'reports.export_pdf': 'Export PDF',
    'reports.export_excel': 'Export Excel',
    'reports.export_csv': 'Export CSV',
    
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.minutes': 'minutes'
  }
}

// Langue active
let currentLanguage = localStorage.getItem('language') || 'fr'

// Fonction de traduction
function t(key) {
  return translations[currentLanguage][key] || key
}

// Changer de langue
function changeLanguage(lang) {
  if (lang !== 'fr' && lang !== 'en') lang = 'fr'
  
  currentLanguage = lang
  localStorage.setItem('language', lang)
  
  // Changer la langue du document
  document.documentElement.lang = lang
  
  // Rafraîchir l'interface
  showToast(lang === 'fr' ? 'Langue changée en Français' : 'Language changed to English', 'success')
  
  // Recharger l'onglet actif
  const activeTab = document.querySelector('.tab-button.border-yellow-500')?.dataset.tab
  if (activeTab) {
    setTimeout(() => switchTab(activeTab), 500)
  }
  
  // Mettre à jour le sélecteur de langue
  updateLanguageSelector()
}

// Mettre à jour le sélecteur de langue
function updateLanguageSelector() {
  const selector = document.getElementById('language-selector')
  if (selector) {
    selector.value = currentLanguage
  }
}

// Ajouter le sélecteur de langue dans la navigation
function addLanguageSelector() {
  const nav = document.querySelector('nav .flex.items-center.justify-between')
  if (nav && !document.getElementById('language-selector')) {
    const wrapper = document.createElement('div')
    wrapper.className = 'ml-4 flex items-center space-x-2'
    
    const icon = document.createElement('i')
    icon.className = 'fas fa-globe text-yellow-500'
    
    const select = document.createElement('select')
    select.id = 'language-selector'
    select.className = 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-sm'
    select.innerHTML = `
      <option value="fr" ${currentLanguage === 'fr' ? 'selected' : ''}>FR</option>
      <option value="en" ${currentLanguage === 'en' ? 'selected' : ''}>EN</option>
    `
    select.onchange = (e) => changeLanguage(e.target.value)
    
    wrapper.appendChild(icon)
    wrapper.appendChild(select)
    nav.appendChild(wrapper)
  }
}


// ============= GESTION DES PAUSES =============

async function startBreak() {
  const reason = prompt('Raison de la pause (optionnel):')
  if (reason === null) return // Annulé
  
  try {
    await apiCall('/breaks/start', {
      method: 'POST',
      data: { reason: reason || '' }
    })
    showNotification('Pause démarrée', 'info')
    currentUser.on_break = 1
    currentUser.is_available = 0
    renderCurrentClient() // Refresh UI
  } catch (error) {
    showNotification(error.response?.data?.error || 'Erreur', 'error')
  }
}

async function endBreak() {
  try {
    const result = await apiCall('/breaks/end', { method: 'POST' })
    showNotification(`Pause terminée (${result.duration_minutes} min)`, 'success')
    currentUser.on_break = 0
    currentUser.is_available = 1
    renderQueue() // Refresh UI
  } catch (error) {
    showNotification(error.response?.data?.error || 'Erreur', 'error')
  }
}

// ============= SYSTÈME DE TICKETS =============

async function showTicket(clientId) {
  try {
    const ticketData = await apiCall(`/tickets/${clientId}`)
    
    // Créer une modal pour afficher le ticket
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    modal.onclick = () => modal.remove()
    
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full animate-fade-in" onclick="event.stopPropagation()">
        <div class="text-center">
          <h2 class="text-2xl font-bold text-yellow-600 mb-4">Ticket MTN</h2>
          
          <div class="bg-yellow-50 dark:bg-gray-700 p-6 rounded-lg mb-4">
            <div class="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              ${ticketData.ticket_number}
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              ${ticketData.client.prenom} ${ticketData.client.nom}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
              ${ticketData.client.type_client}
            </div>
          </div>
          
          <div class="flex justify-center mb-4">
            <div id="qrcode-${clientId}" class="bg-white p-2 rounded"></div>
          </div>
          
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-4">
            ${new Date(ticketData.client.arrival_time).toLocaleString('fr-FR')}
          </div>
          
          <div class="flex gap-2 justify-center">
            <button onclick="printTicket(${clientId})" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg">
              <i class="fas fa-print mr-2"></i>Imprimer
            </button>
            <button onclick="this.closest('.fixed').remove()" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg">
              Fermer
            </button>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Générer le QR code
    setTimeout(() => {
      const qrContainer = document.getElementById(`qrcode-${clientId}`)
      if (qrContainer && typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, {
          text: ticketData.qr_code,
          width: 150,
          height: 150
        })
      }
    }, 100)
  } catch (error) {
    showNotification('Erreur lors de l\'affichage du ticket', 'error')
  }
}

function printTicket(clientId) {
  // Créer une fenêtre d'impression avec le contenu du ticket
  const ticketElement = document.querySelector('.fixed')
  if (ticketElement) {
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    printWindow.document.write(`
      <html>
        <head>
          <title>Ticket MTN</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              text-align: center;
            }
            .ticket-number {
              font-size: 36px;
              font-weight: bold;
              color: #FFC800;
              margin: 20px 0;
            }
            .client-info {
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          ${ticketElement.querySelector('.bg-white.dark\\:bg-gray-800').innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 500)
  }
}

// ============= STATISTIQUES AVANCÉES =============

async function renderAdvancedStatistics() {
  const startDate = localStorage.getItem('stats_start_date') || ''
  const endDate = localStorage.getItem('stats_end_date') || ''
  const selectedConseillers = JSON.parse(localStorage.getItem('stats_conseillers') || '[]')
  const selectedClientTypes = JSON.parse(localStorage.getItem('stats_client_types') || '[]')
  
  // Charger la liste des conseillers pour les filtres
  const conseillers = await apiCall('/users/conseillers')
  
  return `
    <div class="space-y-6 animate-fade-in">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">
          <i class="fas fa-chart-line mr-2"></i>
          Statistiques Avancées
        </h2>
      </div>
      
      <!-- Filtres -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
          <i class="fas fa-filter mr-2"></i>Filtres
        </h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Date début -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date début</label>
            <input type="date" id="stats-start-date" value="${startDate}" 
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
          </div>
          
          <!-- Date fin -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date fin</label>
            <input type="date" id="stats-end-date" value="${endDate}" 
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
          </div>
          
          <!-- Conseillers -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Conseillers</label>
            <select multiple id="stats-conseillers" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white h-20">
              ${conseillers.map(c => `
                <option value="${c.id}" ${selectedConseillers.includes(c.id.toString()) ? 'selected' : ''}>
                  ${c.full_name}
                </option>
              `).join('')}
            </select>
          </div>
          
          <!-- Types de clients -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Types de clients</label>
            <select multiple id="stats-client-types" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white h-20">
              <option value="HVC_OR" ${selectedClientTypes.includes('HVC_OR') ? 'selected' : ''}>VIP Or</option>
              <option value="HVC_ARGENT" ${selectedClientTypes.includes('HVC_ARGENT') ? 'selected' : ''}>HVC Argent</option>
              <option value="HVC_BRONZE" ${selectedClientTypes.includes('HVC_BRONZE') ? 'selected' : ''}>HVC Bronze</option>
              <option value="NON_HVC" ${selectedClientTypes.includes('NON_HVC') ? 'selected' : ''}>Non HVC</option>
            </select>
          </div>
        </div>
        
        <div class="mt-4 flex gap-2">
          <button onclick="applyAdvancedFilters()" class="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium">
            <i class="fas fa-search mr-2"></i>Appliquer les filtres
          </button>
          <button onclick="resetAdvancedFilters()" class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium">
            <i class="fas fa-redo mr-2"></i>Réinitialiser
          </button>
        </div>
      </div>
      
      <!-- Résultats -->
      <div id="advanced-stats-results">
        <div class="text-center text-gray-500 dark:text-gray-400 py-8">
          <i class="fas fa-chart-bar text-4xl mb-4"></i>
          <p>Sélectionnez des filtres et cliquez sur "Appliquer" pour voir les statistiques</p>
        </div>
      </div>
    </div>
  `
}

async function applyAdvancedFilters() {
  const startDate = document.getElementById('stats-start-date').value
  const endDate = document.getElementById('stats-end-date').value
  const conseillers = Array.from(document.getElementById('stats-conseillers').selectedOptions).map(o => o.value)
  const clientTypes = Array.from(document.getElementById('stats-client-types').selectedOptions).map(o => o.value)
  
  // Sauvegarder les filtres
  localStorage.setItem('stats_start_date', startDate)
  localStorage.setItem('stats_end_date', endDate)
  localStorage.setItem('stats_conseillers', JSON.stringify(conseillers))
  localStorage.setItem('stats_client_types', JSON.stringify(clientTypes))
  
  // Construire l'URL avec paramètres
  let url = '/statistics/advanced?'
  if (startDate) url += `start_date=${startDate}&`
  if (endDate) url += `end_date=${endDate}&`
  if (conseillers.length > 0) url += `conseillers=${conseillers.join(',')}&`
  if (clientTypes.length > 0) url += `client_types=${clientTypes.join(',')}&`
  
  try {
    const data = await apiCall(url)
    displayAdvancedStats(data)
  } catch (error) {
    showNotification('Erreur lors du chargement des statistiques', 'error')
  }
}

function displayAdvancedStats(data) {
  const resultsDiv = document.getElementById('advanced-stats-results')
  
  resultsDiv.innerHTML = `
    <div class="space-y-6">
      <!-- Statistiques par type de client -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
          <i class="fas fa-users mr-2"></i>Par type de client
        </h3>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr class="border-b dark:border-gray-700">
                <th class="text-left py-2 px-4">Type</th>
                <th class="text-right py-2 px-4">Total</th>
                <th class="text-right py-2 px-4">Attente moy.</th>
                <th class="text-right py-2 px-4">Service moy.</th>
                <th class="text-right py-2 px-4">Total moy.</th>
              </tr>
            </thead>
            <tbody>
              ${data.by_client_type.map(row => `
                <tr class="border-b dark:border-gray-700">
                  <td class="py-2 px-4">${row.type_client}</td>
                  <td class="text-right py-2 px-4">${row.total}</td>
                  <td class="text-right py-2 px-4">${Math.round(row.avg_waiting || 0)} min</td>
                  <td class="text-right py-2 px-4">${Math.round(row.avg_service || 0)} min</td>
                  <td class="text-right py-2 px-4">${Math.round(row.avg_total || 0)} min</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Performance détaillée par conseiller -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
          <i class="fas fa-user-tie mr-2"></i>Performance détaillée des conseillers
        </h3>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b dark:border-gray-700">
                <th class="text-left py-2 px-4">Conseiller</th>
                <th class="text-right py-2 px-4">Clients</th>
                <th class="text-right py-2 px-4">VIP</th>
                <th class="text-right py-2 px-4">Argent</th>
                <th class="text-right py-2 px-4">Bronze</th>
                <th class="text-right py-2 px-4">Non-HVC</th>
                <th class="text-right py-2 px-4">Service moy.</th>
                <th class="text-right py-2 px-4">Pause total</th>
              </tr>
            </thead>
            <tbody>
              ${data.conseiller_detailed.map(row => `
                <tr class="border-b dark:border-gray-700">
                  <td class="py-2 px-4">${row.full_name}</td>
                  <td class="text-right py-2 px-4 font-semibold">${row.total_clients || 0}</td>
                  <td class="text-right py-2 px-4">${row.vip_count || 0}</td>
                  <td class="text-right py-2 px-4">${row.argent_count || 0}</td>
                  <td class="text-right py-2 px-4">${row.bronze_count || 0}</td>
                  <td class="text-right py-2 px-4">${row.non_hvc_count || 0}</td>
                  <td class="text-right py-2 px-4">${Math.round(row.avg_service || 0)} min</td>
                  <td class="text-right py-2 px-4">${row.total_break_time_minutes || 0} min</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Évolution par jour -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
          <i class="fas fa-calendar-alt mr-2"></i>Évolution par jour
        </h3>
        <canvas id="chart-by-day" height="80"></canvas>
      </div>
    </div>
  `
  
  // Créer le graphique d'évolution par jour
  setTimeout(() => {
    const ctx = document.getElementById('chart-by-day')
    if (ctx && data.stats_by_day.length > 0) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.stats_by_day.map(d => d.date).reverse(),
          datasets: [
            {
              label: 'Clients traités',
              data: data.stats_by_day.map(d => d.total_clients).reverse(),
              borderColor: '#FFC800',
              backgroundColor: 'rgba(255, 200, 0, 0.1)',
              yAxisID: 'y'
            },
            {
              label: 'Temps attente (min)',
              data: data.stats_by_day.map(d => Math.round(d.avg_waiting || 0)).reverse(),
              borderColor: '#EF4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              yAxisID: 'y1'
            },
            {
              label: 'Temps service (min)',
              data: data.stats_by_day.map(d => Math.round(d.avg_service || 0)).reverse(),
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'Nombre de clients'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: 'Temps (minutes)'
              },
              grid: {
                drawOnChartArea: false
              }
            }
          }
        }
      })
    }
  }, 100)
}

function resetAdvancedFilters() {
  document.getElementById('stats-start-date').value = ''
  document.getElementById('stats-end-date').value = ''
  document.getElementById('stats-conseillers').selectedIndex = -1
  document.getElementById('stats-client-types').selectedIndex = -1
  localStorage.removeItem('stats_start_date')
  localStorage.removeItem('stats_end_date')
  localStorage.removeItem('stats_conseillers')
  localStorage.removeItem('stats_client_types')
  document.getElementById('advanced-stats-results').innerHTML = `
    <div class="text-center text-gray-500 dark:text-gray-400 py-8">
      <i class="fas fa-chart-bar text-4xl mb-4"></i>
      <p>Sélectionnez des filtres et cliquez sur "Appliquer" pour voir les statistiques</p>
    </div>
  `
}
