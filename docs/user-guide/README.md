# Guide Utilisateur

Bienvenue dans le guide utilisateur de la plateforme **IAD & SmartQueue AI**.

## 1. Première Connexion

L'accès au tableau de bord se fait via un navigateur web.
1. Rendez-vous sur l'adresse fournie par votre administrateur (ex: `http://localhost:5173`).
2. Entrez votre email et votre mot de passe fournis.
3. En cas d'oubli, contactez votre administrateur.

## 2. Tableau de Bord (Overview)

La vue principale affiche un condensé des indicateurs clés pour vos sites (si vous êtes Manager) ou tous les sites (si vous êtes Administrateur). Vous y retrouverez le nombre de visiteurs aujourd'hui, les pics d'affluence, et le statut global des périphériques.

## 3. Gestion des Sites (Sites)

La page **Sites** vous permet d'organiser vos implantations physiques.
* **Ajouter un site** (Admin uniquement) : Cliquez sur "Nouveau Site", indiquez le nom, l'adresse, et définissez un seuil critique d'alerte pour la file d'attente.
* **Modifier** : Vous permet de changer le nom ou d'ajuster les seuils d'alertes à tout moment.

## 4. Gestion de la Flotte (Fleet)

La page **Fleet** liste tous les appareils matériels connectés à la plateforme.
* **Statuts** :
  * `ONLINE` (vert) : Fonctionne correctement.
  * `WARNING` (orange) : Le périphérique est connecté mais ne répond plus depuis quelques secondes.
  * `UNPAIRED` (gris) : Un appareil a été branché et détecté, mais il n'est assigné à aucun de vos sites.
* **Appairer un appareil** : Cliquez sur le bouton d'action d'un périphérique `UNPAIRED` et sélectionnez le site dans lequel il se trouve.

## 5. Analytique en direct (Live Analytics)

Cette vue vous permet d'observer la fréquentation d'un site en temps réel. Les données sont mises à jour chaque seconde (via MQTT) sans que vous ayez besoin de rafraîchir la page. Vous y verrez le taux de densité actuel de la salle, ainsi que l'évolution de la journée sous forme de graphique.

## 6. Création de Campagnes Publicitaires

La page **Campaigns** vous permet d'animer les écrans connectés.
1. Cliquez sur "Créer une campagne".
2. Donnez un nom et définissez la durée de diffusion souhaitée (ex: 15 secondes).
3. **Upload** : Envoyez votre fichier vidéo ou image.
4. **Ciblage (Audience)** : Définissez quel public doit être majoritairement présent dans la pièce pour déclencher cette campagne (ex: public Adulte, Homme).
5. Sauvegardez. La campagne commencera à être distribuée automatiquement aux écrans concernés.

## 7. Performances des Campagnes

Rendez-vous dans la sous-rubrique **Campaign Performance** pour observer l'efficacité réelle de vos campagnes. Vous y verrez les impressions totales, le temps d'attention estimé des visiteurs (Dwell Time) et un classement des campagnes les plus efficaces (Leaderboard).
