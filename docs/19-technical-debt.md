# 19 - Dette Technique

La dette technique regroupe les raccourcis pris durant le développement qui devront être remboursés (refactorisés) pour garantir la maintenabilité à long terme.

## 19.1 Inventaire de la Dette Technique

| Problème | Impact | Priorité | Solution Recommandée |
| -------- | ------ | -------- | -------------------- |
| **Gestion des Secrets** | Le fichier `.env` gère tous les mots de passe. Il n'y a pas de solution de Vault intégrée pour la production. | High | Intégrer un système de gestion de secrets (HashiCorp Vault, AWS Secrets Manager) pour l'environnement de production. |
| **Tests E2E Frontend** | Absence de framework de tests end-to-end (comme Playwright ou Cypress) pour le Frontend. | Medium | Ajouter Cypress ou Playwright pour automatiser les tests des parcours critiques (Création de campagne, Appairage d'écran). |
| **Estimation d'âge heuristique** | Le script `age_estimation.py` ne semble pas utiliser un modèle ONNX dédié mais mentionne un fallback heuristique dans le code source de l'Edge CV. | Medium | Intégrer un véritable modèle de classification (ONNX) entraîné spécifiquement pour la prédiction de l'âge et du genre. |
| **Dépendance excessive à `docker-compose`** | Pas de manifests Kubernetes, rendant le déploiement multi-serveurs difficile (haute disponibilité impossible en l'état). | Low | Rédiger des chartes Helm ou des manifests K8s pour préparer la mise à l'échelle. |
| **Nettoyage du code expérimental** | Des fichiers de script isolés existent à la racine du projet (`test-compute.js`, `test_mqtt.py`, `test_img.jpg`). | Low | Déplacer ces fichiers dans un dossier `scratch/` ou les supprimer s'ils ne sont plus utiles. |
