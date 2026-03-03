# Guide de déploiement – Quiz Live

## Architecture simplifiée

```
quiz-realtime/
├── server/
│   ├── src/          ← Backend Node.js (Express + Socket.IO)
│   │   ├── index.js       Point d'entrée du serveur
│   │   ├── socket.js      Gestion WebSocket (Socket.IO)
│   │   ├── engine.js      Moteur de jeu (phases, scores, timer)
│   │   ├── store.js       État en mémoire (sessions, quiz)
│   │   ├── gameState.js   Modèle d'état de partie
│   │   ├── persistence.js Sauvegarde JSON sur disque
│   │   ├── upload.js      Upload de médias (multer)
│   │   ├── config.js      Configuration (.env)
│   │   └── utils.js       Utilitaires
│   ├── public/       ← Frontend statique (servi par Express)
│   │   ├── index.html     Point d'entrée HTML (SPA)
│   │   ├── style.css      Feuille de style
│   │   ├── app.js         Logique JS complète (vanilla)
│   │   ├── pictures/      Images
│   │   ├── gif/           GIFs
│   │   ├── video/         Vidéos
│   │   └── msc/           Musiques (optionnel)
│   ├── data/         ← Données persistées (JSON)
│   │   ├── quizzes.json
│   │   └── sessions.json
│   ├── uploads/      ← Fichiers uploadés via admin
│   ├── .env          ← Variables d'environnement (NE PAS committer)
│   └── package.json
```

---

## Déploiement sur un VPS (Ubuntu/Debian) avec Nginx

### Étape 1 – Prérequis sur le serveur

Connectez-vous à votre VPS en SSH :

```bash
ssh user@votre-ip
```

Installez Node.js (version 18 ou supérieure) :

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # doit afficher v20.x.x
```

Installez PM2 (gestionnaire de processus) :

```bash
sudo npm install -g pm2
```

### Étape 2 – Copier le projet sur le serveur

Depuis votre ordinateur local, envoyez le dossier `server/` via rsync ou scp :

```bash
# Depuis votre machine locale :
rsync -av --exclude='node_modules' --exclude='uploads' \
  "quiz-realtime - test/server/" user@votre-ip:~/quiz-live/
```

> **Note :** Ne transférez pas `node_modules/` – il sera réinstallé sur le serveur.

Ou avec git :

```bash
# Sur le serveur :
git clone https://votre-repo.git ~/quiz-live
cd ~/quiz-live
```

### Étape 3 – Installer les dépendances

```bash
cd ~/quiz-live
npm install
```

### Étape 4 – Configurer les variables d'environnement

Créez (ou modifiez) le fichier `.env` dans `~/quiz-live/` :

```bash
nano .env
```

Contenu minimal à adapter :

```env
PORT=3003
CLIENT_ORIGIN=https://votre-domaine.fr
PUBLIC_BASE_URL=https://votre-domaine.fr
UPLOAD_DIR=uploads
HOST_SECRET=un-secret-fort-ici
ADMIN_SECRET=un-autre-secret-fort
```

> **Important :** Remplacez `votre-domaine.fr` par votre vrai nom de domaine.

### Étape 5 – Créer les dossiers nécessaires

```bash
mkdir -p ~/quiz-live/uploads
mkdir -p ~/quiz-live/data
```

### Étape 6 – Lancer l'application avec PM2

```bash
cd ~/quiz-live
pm2 start src/index.js --name quiz-live
pm2 save          # Sauvegarder pour redémarrage auto
pm2 startup       # Activer au démarrage du système (suivre les instructions affichées)
```

Vérifier que l'application tourne :

```bash
pm2 status
pm2 logs quiz-live --lines 30
```

### Étape 7 – Configurer Nginx comme reverse proxy

Installez Nginx si ce n'est pas fait :

```bash
sudo apt-get install -y nginx
```

Créez la configuration du site :

```bash
sudo nano /etc/nginx/sites-available/quiz-live
```

Collez cette configuration (adaptez le domaine) :

```nginx
server {
    listen 80;
    server_name votre-domaine.fr www.votre-domaine.fr;

    # Taille max pour les uploads (images, audio, vidéo)
    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:3003;
        proxy_http_version 1.1;

        # Headers requis pour Socket.IO (WebSocket)
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout long pour Socket.IO
        proxy_read_timeout 86400;
    }
}
```

Activez le site et rechargez Nginx :

```bash
sudo ln -s /etc/nginx/sites-available/quiz-live /etc/nginx/sites-enabled/
sudo nginx -t          # Vérifier la config
sudo systemctl reload nginx
```

### Étape 8 – Activer HTTPS avec Let's Encrypt (Certbot)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.fr -d www.votre-domaine.fr
```

Certbot met à jour automatiquement la config Nginx pour HTTPS.

Vérifiez le renouvellement automatique :

```bash
sudo certbot renew --dry-run
```

### Étape 9 – Tester

Ouvrez votre navigateur sur `https://votre-domaine.fr`.

Vous devriez voir la page d'accueil de Quiz Live.

---

## Mise à jour de l'application

Pour mettre à jour après avoir modifié le code :

```bash
# Transférer les nouveaux fichiers
rsync -av --exclude='node_modules' --exclude='uploads' --exclude='data' \
  "quiz-realtime - test/server/" user@votre-ip:~/quiz-live/

# Sur le serveur :
cd ~/quiz-live
npm install          # Si les dépendances ont changé
pm2 restart quiz-live
pm2 logs quiz-live --lines 20
```

---

## Utilisation de l'application

### Pages disponibles

| URL / Hash        | Rôle               | Description                          |
|-------------------|--------------------|--------------------------------------|
| `/`               | Accueil            | Navigation vers les différentes pages|
| `/#player`        | Joueur             | Rejoindre une partie et jouer        |
| `/#host`          | Maître de jeu      | Contrôler le déroulement             |
| `/#display`       | Écran TV           | Affichage grand écran pour spectateurs|
| `/#admin`         | Administrateur     | Créer et gérer les quiz              |
| `/?join=CODE`     | Lien direct joueur | Ouvre directement la page joueur avec le code|

### Démarrer une partie

1. **Admin** → Créer un quiz avec ses manches et questions → Enregistrer
2. **Admin** → Cliquer "▶️ Lancer" sur le quiz → Saisir un code de session et une clé host
3. **Host** → Se connecter avec le code + clé → Contrôler la partie
4. **Joueurs** → Aller sur `https://votre-domaine.fr/?join=CODE` → Rejoindre avec un pseudo
5. **Écran TV** → Aller sur `/#display` → Saisir le code session → Projeter

---

## Commandes utiles (serveur)

```bash
pm2 status             # État de l'app
pm2 logs quiz-live     # Logs en temps réel
pm2 restart quiz-live  # Redémarrer
pm2 stop quiz-live     # Arrêter
pm2 delete quiz-live   # Supprimer de PM2

# Voir les connexions actives
ss -tlnp | grep 3003
```

---

## En cas de problème

**L'app ne démarre pas :**
```bash
cd ~/quiz-live && node src/index.js   # Démarrage direct pour voir les erreurs
```

**WebSocket ne fonctionne pas :**
- Vérifier que Nginx a les headers `Upgrade` et `Connection "upgrade"`
- Vérifier que `proxy_read_timeout` est configuré

**Uploads refusés :**
- Vérifier les permissions : `chmod 755 ~/quiz-live/uploads`
- Vérifier `client_max_body_size 50M` dans Nginx

**Port déjà utilisé :**
```bash
lsof -i :3003           # Voir quel process utilise le port
```
