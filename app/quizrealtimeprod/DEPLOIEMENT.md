# Guide de déploiement – Quiz Live v2

> **Infos d'hébergement actuels**
> - Port : `3013`
> - Domaine : `quizzwegeek.havelsoftware.fr`
> - Répertoire : `/home/havelsoftware-quizzwegeek/app/quizrealtimeprod/server/`

---

## Architecture du projet

```
quizrealtimeprod/
├── server/
│   ├── src/               ← Backend Node.js (Express + Socket.IO)
│   │   ├── index.js       Point d'entrée du serveur
│   │   ├── socket.js      Gestion WebSocket (Socket.IO)
│   │   ├── engine.js      Moteur de jeu (phases, scores, timer)
│   │   ├── store.js       État en mémoire (sessions, quiz)
│   │   ├── gameState.js   Modèle d'état de partie
│   │   ├── persistence.js Sauvegarde JSON sur disque
│   │   ├── upload.js      Upload de médias (multer)
│   │   ├── config.js      Configuration (.env)
│   │   └── utils.js       Utilitaires
│   ├── public/            ← Frontend statique (servi par Express)
│   │   ├── index.html     Point d'entrée HTML (SPA)
│   │   ├── style.css      Feuille de style
│   │   ├── app.js         Logique JS (vanilla)
│   │   ├── pictures/      Images
│   │   ├── gif/           GIFs
│   │   └── video/         Vidéos
│   ├── data/              ← Données persistées (JSON) — NE PAS supprimer
│   │   ├── quizzes.json
│   │   └── sessions.json
│   ├── uploads/           ← Fichiers uploadés via admin
│   ├── .env               ← Variables d'environnement (NE PAS committer)
│   └── package.json
```

---

## Déploiement initial sur VPS (Ubuntu/Debian) avec Nginx / CloudPanel

### Étape 1 – Prérequis

```bash
ssh user@votre-ip
```

Installer Node.js 20 :
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # doit afficher v20.x.x
```

Installer PM2 :
```bash
sudo npm install -g pm2
```

### Étape 2 – Transférer le projet

Depuis votre machine locale (en excluant node_modules / uploads / data) :
```bash
rsync -av --exclude='node_modules' --exclude='uploads' --exclude='data' \
  ./server/ user@votre-ip:/home/havelsoftware-quizzwegeek/app/quizrealtimeprod/server/
```

Ou via Git :
```bash
git clone https://votre-repo.git /home/havelsoftware-quizzwegeek/app/quizrealtimeprod
```

### Étape 3 – Installer les dépendances

```bash
cd /home/havelsoftware-quizzwegeek/app/quizrealtimeprod/server
npm install
```

### Étape 4 – Configurer `.env`

Contenu du fichier `.env` (déjà présent sur le serveur) :

```env
PORT=3013
CLIENT_ORIGIN=https://quizzwegeek.havelsoftware.fr
PUBLIC_BASE_URL=https://quizzwegeek.havelsoftware.fr

# Pour autoriser plusieurs origines (sous-domaines, etc.) séparer par virgule :
# ALLOWED_ORIGINS=https://quizzwegeek.havelsoftware.fr,https://test.quizzwegeek.havelsoftware.fr
ALLOWED_ORIGINS=

HOST_SECRET=VotreSecretFort
ADMIN_SECRET=VotreSecretAdmin

UPLOAD_DIR=uploads
```

> **CORS multi-domaines** : renseignez `ALLOWED_ORIGINS` avec toutes les origines autorisées
> séparées par des virgules. Si vide, seul `CLIENT_ORIGIN` est autorisé.

### Étape 5 – Créer les dossiers nécessaires

```bash
mkdir -p /home/havelsoftware-quizzwegeek/app/quizrealtimeprod/server/uploads
mkdir -p /home/havelsoftware-quizzwegeek/app/quizrealtimeprod/server/data
```

### Étape 6 – Lancer avec PM2

```bash
cd /home/havelsoftware-quizzwegeek/app/quizrealtimeprod/server
pm2 start src/index.js --name quiz-live
pm2 save
pm2 startup   # Suivez les instructions affichées
```

Vérifier :
```bash
pm2 status
pm2 logs quiz-live --lines 30
```

### Étape 7 – Configuration Nginx (reverse proxy)

```bash
sudo nano /etc/nginx/sites-available/quiz-live
```

Configuration complète :

```nginx
server {
    listen 80;
    server_name quizzwegeek.havelsoftware.fr;

    # Limite upload (images, audio, vidéo)
    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:3013;
        proxy_http_version 1.1;

        # Headers requis pour Socket.IO (WebSocket)
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout long pour Socket.IO (connexions longues)
        proxy_read_timeout 86400;
    }
}
```

Activer et recharger :
```bash
sudo ln -s /etc/nginx/sites-available/quiz-live /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Étape 8 – HTTPS avec Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d quizzwegeek.havelsoftware.fr
sudo certbot renew --dry-run
```

### Étape 9 – Tester

Ouvrez `https://quizzwegeek.havelsoftware.fr` dans votre navigateur.

---

## Mise à jour de l'application

```bash
# Transférer les fichiers modifiés
rsync -av --exclude='node_modules' --exclude='uploads' --exclude='data' \
  ./server/ user@votre-ip:/home/havelsoftware-quizzwegeek/app/quizrealtimeprod/server/

# Sur le serveur
cd /home/havelsoftware-quizzwegeek/app/quizrealtimeprod/server
npm install          # Si package.json a changé
pm2 restart quiz-live
pm2 logs quiz-live --lines 20
```

---

## Utilisation de l'application

### Pages disponibles

| URL / Hash      | Rôle               | Description                                    |
|-----------------|--------------------|------------------------------------------------|
| `/`             | Accueil            | Navigation vers les différentes pages          |
| `/#player`      | Joueur             | Rejoindre une partie depuis son téléphone      |
| `/#host`        | Maître de jeu      | Contrôler le déroulement de la partie          |
| `/#display`     | Écran TV           | Affichage grand écran pour spectateurs         |
| `/#admin`       | Administrateur     | Créer et gérer les quiz                        |
| `/?join=CODE`   | Lien direct joueur | Ouvre directement la page joueur avec le code  |

### Démarrer une partie (flux normal)

1. **Admin** → Créer un quiz (manches + questions) → Enregistrer
2. **Admin** → Cliquer `▶️ Lancer` sur le quiz → Saisir code de session + clé host
3. **Host** → Connexion automatique → Contrôler la partie depuis l'onglet Contrôle
4. **Joueurs** → Aller sur `https://quizzwegeek.havelsoftware.fr/?join=CODE`
5. **Écran TV** → Aller sur `/#display` → Entrer le code → Projeter

### Créer une partie de test rapide

Depuis la page d'accueil → cliquer **🚀 Partie de test** :
- Sélectionner un quiz existant
- Le code et la clé sont pré-remplis aléatoirement
- Choisir combien de bots ajouter automatiquement
- Cliquer **Lancer** : vous arrivez directement sur la page Host avec les bots déjà ajoutés

### Ajouter des bots manuellement

Depuis **Host → Onglet Joueurs** :
- Saisir un nom (ou laisser vide pour un nom aléatoire)
- Choisir l'équipe (optionnel)
- Cliquer **+ Ajouter** ou utiliser les boutons `+3 bots`, `+5 bots`, `+10 bots`

---

## Gestion CORS (sous-domaines)

Si vous avez un sous-domaine (ex: `test.quizzwegeek.havelsoftware.fr`), ajoutez-le dans `.env` :

```env
ALLOWED_ORIGINS=https://quizzwegeek.havelsoftware.fr,https://test.quizzwegeek.havelsoftware.fr
```

Puis redémarrez : `pm2 restart quiz-live`

---

## Commandes utiles

```bash
pm2 status             # État de l'app
pm2 logs quiz-live     # Logs en temps réel
pm2 restart quiz-live  # Redémarrer
pm2 stop quiz-live     # Arrêter
pm2 delete quiz-live   # Supprimer de PM2

# Vérifier le port
ss -tlnp | grep 3013

# Logs Nginx
sudo tail -f /var/log/nginx/error.log
```

---

## Résolution de problèmes fréquents

**L'app ne démarre pas :**
```bash
cd /home/havelsoftware-quizzwegeek/app/quizrealtimeprod/server
node src/index.js   # Démarrage direct pour voir l'erreur
```

**Page blanche / styles absents :**
- Vérifier que PM2 est bien en cours (`pm2 status`)
- Vérifier la config Nginx (`proxy_pass http://127.0.0.1:3013`)
- Vérifier les logs : `pm2 logs quiz-live`

**WebSocket ne fonctionne pas :**
- Vérifier les headers Nginx : `Upgrade $http_upgrade` et `Connection "upgrade"`
- Vérifier `proxy_read_timeout 86400`
- Ouvrir la console navigateur (F12) pour voir les erreurs

**Erreurs CORS :**
- Vérifier `CLIENT_ORIGIN` dans `.env` (doit correspondre exactement à l'URL du frontend)
- Pour plusieurs domaines : renseigner `ALLOWED_ORIGINS`
- Redémarrer après chaque changement `.env` : `pm2 restart quiz-live`

**Uploads refusés :**
- Vérifier les permissions : `chmod 755 uploads/`
- Vérifier `client_max_body_size 50M` dans Nginx

**Port déjà utilisé :**
```bash
lsof -i :3013   # Voir quel processus utilise le port
```
