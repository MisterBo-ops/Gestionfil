# 🎯 Système de Gestion de File d'Attente - Agence MTN

Application web complète pour la gestion intelligente des files d'attente dans une agence de communication avec 12 agents (1 Chef, 1 Team Leader, 10 Conseillers).

## 🌐 URLs

- **Application Sandbox** : https://3000-ix94we9gk7723rdlhgt3m-c07dda5e.sandbox.novita.ai
- **GitHub** : (À configurer lors du déploiement)

## ✨ Fonctionnalités Principales

### 🔐 Authentification & Gestion des Rôles
- **3 niveaux d'accès** : Chef d'agence, Team Leader, Conseiller Client
- **Gestion complète des conseillers** : Le Chef et le Team Leader peuvent :
  - ✅ Créer de nouveaux conseillers
  - ✅ Modifier les informations (nom complet, username, mot de passe)
  - ✅ Activer/Désactiver les comptes
  - ✅ Supprimer les conseillers (avec vérifications de sécurité)
- **Sessions sécurisées** : Authentification par token avec bcrypt

### 👥 Gestion des Conseillers (Chef/Team Leader)

#### Création de Conseillers
- Formulaire complet : nom complet, username, mot de passe
- Validation de l'unicité du username
- Hashage sécurisé des mots de passe (bcrypt)
- Log automatique des créations

#### Modification de Conseillers
- **Modal d'édition** avec formulaire pré-rempli
- Modification du nom complet
- Changement du username (avec vérification de disponibilité)
- Réinitialisation du mot de passe (optionnel)
- Mise à jour en temps réel après modification

#### Suppression de Conseillers
- **Protection de sécurité** : Impossible de supprimer un conseiller avec client en cours
- Confirmation obligatoire avant suppression
- Suppression des sessions associées
- Conservation de l'historique dans les logs
- Action irréversible avec message d'avertissement

#### Activation/Désactivation
- Toggle rapide du statut actif/inactif
- Les conseillers désactivés ne peuvent plus se connecter
- État visible par code couleur (vert/rouge)

### 👥 Gestion des Clients

#### Enregistrement à l'Accueil (Tous les agents)
- Nom, prénom, numéro MTN (obligatoire)
- Second contact (facultatif)
- Raison de la visite
- **Type de client avec priorités** :
  - **HVC Or** : Priorité 1 (VIP) - Alertes si longue attente (>30min)
  - **HVC Bronze/Argent** : Priorité 2 
  - **Non-HVC** : Priorité 3

#### File d'Attente Intelligente
- **Tri automatique** par priorité puis heure d'arrivée
- **Affichage en temps réel** des temps d'attente
- **Alertes visuelles** pour clients VIP en longue attente
- **Visibilité complète** pour tous les agents connectés

### 💼 Interface Conseiller Client

- **Appel de clients** depuis la file d'attente
- **Gestion mono-client** : Un conseiller ne peut traiter qu'un client à la fois
- **Monitoring du temps** : Temps d'attente et temps de service en direct
- **Clôture de service** : Enregistrement automatique des durées

### 📊 Tableau de Bord (Chef/Team Leader)

#### Statistiques en Temps Réel
- Clients en attente
- Clients en service
- Clients traités aujourd'hui
- Conseillers disponibles
- Temps d'attente moyen

#### Monitoring des Agents
- **Liste des agents connectés** avec statut (disponible/occupé)
- **Vue en temps réel** : Quel conseiller est avec quel client
- **Temps de connexion** de chaque agent

### 📈 Rapports d'Activité

**Périodes configurables** : Jour / Semaine / Mois / Année

- **Total clients traités**
- **Temps moyens** : Attente, service, total
- **Performance par conseiller** : Nombre de clients servis, temps moyens
- **Répartition par type de client** : VIP, HVC, Non-HVC

### ⏱️ Monitoring & Alertes

- **Calcul automatique** des temps d'attente et de service
- **Alertes visuelles** pour clients VIP (>30min d'attente)
- **Auto-refresh** : Mise à jour automatique toutes les 30 secondes
- **Logs d'activité** : Traçabilité complète de toutes les actions

## 🗄️ Architecture des Données

### Tables Principales

#### `users` - Utilisateurs
- Gestion des 3 rôles (chef, team_leader, conseiller)
- Statut actif/inactif
- Disponibilité (pour les conseillers)

#### `clients` - Clients en file d'attente
- Informations personnelles (nom, prénom, contacts)
- Type et priorité de client
- Statut (waiting, in_service, completed)
- Timestamps complets (arrivée, début service, fin service)
- Temps calculés (attente, service, total)

#### `sessions` - Sessions de connexion
- Gestion des tokens d'authentification
- Tracking connexion/déconnexion

#### `activity_logs` - Logs d'activité
- Traçabilité de toutes les actions
- Base pour les rapports

## 👤 Comptes de Test

```
Chef d'Agence :
- Username : admin
- Password : admin123

Team Leader :
- Username : teamleader
- Password : team123

Conseiller 1 :
- Username : conseiller1
- Password : conseil123

Conseiller 2 :
- Username : conseiller2
- Password : conseil123

Conseiller 3 :
- Username : conseiller3
- Password : conseil123
```

## 🚀 Guide d'Utilisation

### Pour le Chef d'Agence / Team Leader

1. **Connexion** avec identifiants admin/teamleader
2. **Tableau de bord** : Vue d'ensemble des statistiques en temps réel
3. **Gestion Conseillers** : 
   - Créer de nouveaux conseillers
   - Modifier les informations (nom, username, mot de passe)
   - Activer/Désactiver les comptes
   - Supprimer des conseillers (avec protections)
4. **Rapports** : Générer des rapports d'activité par période (jour/semaine/mois/année)

### Pour les Conseillers Clients

1. **Connexion** avec identifiants conseiller
2. **Enregistrer un client** : Saisir les informations à l'accueil
3. **Appeler un client** : Depuis la file d'attente
4. **Traiter la demande** : Le client passe en "Client actuel"
5. **Terminer le service** : Le conseiller redevient disponible

### Pour l'Accueil (Tous les agents)

- **Enregistrement rapide** des clients arrivants
- Formulaire simple et intuitif
- Sélection du type de client pour priorité automatique

## 🛠️ Stack Technique

- **Backend** : Hono (framework edge léger)
- **Base de données** : Cloudflare D1 (SQLite distribué)
- **Frontend** : HTML/CSS/JS avec TailwindCSS
- **Authentification** : JWT + bcrypt
- **Déploiement** : Cloudflare Pages
- **Process Manager** : PM2 (développement)

## 📝 Commandes Utiles

```bash
# Développement local
npm run dev:sandbox          # Démarrer le serveur de dev
npm run build                # Builder le projet
npm run db:migrate:local     # Appliquer les migrations
npm run db:seed              # Charger les données de test
npm run db:reset             # Reset complet de la DB

# Production
npm run deploy               # Déployer sur Cloudflare Pages
npm run db:migrate:prod      # Migrations en production

# PM2
pm2 list                     # Lister les services
pm2 logs queue-manager       # Voir les logs
pm2 restart queue-manager    # Redémarrer
```

## 📊 Statistiques Actuelles (Données de test)

- ✅ **3 clients** enregistrés en file d'attente
- ✅ **3 conseillers** actifs et disponibles
- ✅ **Système de priorités** opérationnel
- ✅ **Auto-refresh** configuré (30s)

## 🔄 Flux de Travail Complet

1. **Client arrive** → Agent d'accueil enregistre (nom, contact, type, raison)
2. **Client placé** → File d'attente triée par priorité
3. **Conseiller disponible** → Appelle le prochain client prioritaire
4. **Service en cours** → Timer activé, conseiller occupé
5. **Service terminé** → Statistiques enregistrées, conseiller disponible
6. **Rapports** → Chef/Team Leader consultent les performances

## 🎨 Interface Utilisateur

- **Design moderne** : TailwindCSS avec thème jaune MTN
- **Responsive** : Adapté mobile, tablette, desktop
- **Icônes FontAwesome** : Interface intuitive
- **Notifications** : Retours visuels pour chaque action
- **Badges de priorité** : Identification visuelle des VIP

## 🔒 Sécurité

- ✅ Mots de passe hashés (bcrypt)
- ✅ Sessions sécurisées par token
- ✅ Autorisations par rôle
- ✅ Validation des données côté serveur
- ✅ Protection CORS

## 🎯 Fonctionnalités Complètes

✅ **Chef/Team Leader peuvent créer des conseillers**  
✅ **Modification complète des conseillers** (nom, username, mot de passe)  
✅ **Suppression sécurisée des conseillers** (avec vérifications)  
✅ **Activation/Désactivation des comptes**  
✅ **Conseillers enregistrés peuvent se connecter**  
✅ **Tous les agents peuvent enregistrer les clients**  
✅ **Seuls les conseillers peuvent appeler/traiter**  
✅ **Système de priorités VIP fonctionnel**  
✅ **Alertes pour clients VIP en longue attente**  
✅ **Vue en temps réel de tous les agents connectés**  
✅ **Rapports d'activité complets**  
✅ **Monitoring des temps d'attente et de service**  

## 📈 Améliorations Futures Possibles

1. **Notifications en temps réel** : WebSocket pour mises à jour push
2. **Statistiques avancées** : Graphiques de performance
3. **Export de rapports** : PDF/Excel
4. **SMS automatiques** : Notification clients pour leur tour
5. **Gestion des pauses** : Tracking des temps de pause conseillers
6. **Multi-agences** : Support de plusieurs agences
7. **Rendez-vous** : Système de prise de RDV en ligne

## 🚀 Déploiement en Production

L'application est prête pour le déploiement sur Cloudflare Pages. Pour déployer :

1. Configurer l'API Key Cloudflare
2. Créer la base D1 en production
3. Appliquer les migrations
4. Déployer avec `npm run deploy:prod`

## 📞 Support & Maintenance

- **Logs PM2** : Monitoring des erreurs en temps réel
- **Base de données locale** : Développement et tests rapides
- **Migrations versionnées** : Évolution contrôlée du schéma
- **Seeds de test** : Environnement de développement complet

---

**Développé avec ❤️ pour la gestion efficace des files d'attente en agence**

*Dernière mise à jour : 15 février 2026*

## 🆕 Changelog

### Version 1.1 - 15 février 2026
- ✨ Ajout de la modification des conseillers
- ✨ Ajout de la suppression des conseillers avec vérifications
- 🎨 Interface améliorée avec modal d'édition
- 🔒 Protection contre la suppression de conseillers occupés
- 📝 Logs d'activité pour modification et suppression

### Version 1.0 - 15 février 2026
- 🎉 Première version complète du système
- ✅ Authentification multi-rôles
- ✅ Gestion de file d'attente avec priorités VIP
- ✅ Tableau de bord temps réel
- ✅ Système de rapports
