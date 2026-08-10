# 14 - Tests

Le projet intègre différents niveaux de tests pour garantir sa stabilité, notamment dans les environnements de développement et de CI.

## 14.1 Tests Backend (NestJS)

Le Backend utilise le framework **Jest**.

| Type de Test | Commande | Description |
| ------------ | -------- | ----------- |
| Unitaires | `npm run test` | Test des services et de la logique isolée. |
| Couverture | `npm run test:cov` | Génère un rapport de couverture de code. |
| E2E | `npm run test:e2e` | Tests d'intégration de bout en bout (requêtes HTTP simulées via Supertest). Localisés dans `apps/backend/test/`. |

## 14.2 Tests Edge CV (Python)

L'application Python utilise **Pytest** pour ses tests, situés dans le répertoire `apps/edge-cv/tests/`.

| Commande (via pytest) | Description |
| --------------------- | ----------- |
| `pytest` | Lance l'ensemble des tests Python. |
| `pytest --cov=app` | Rapport de couverture. |

L'architecture intègre une notion de *Skip Load* (`MODEL_SKIP_LOAD="true"` dans le `docker-compose.yml` ou les variables d'environnement). Cela permet de faire tourner les tests CI sans avoir à charger les lourds modèles YOLO en mémoire.

## 14.3 Tests SmartQueue ML (Python)

Similaire à Edge-CV, SmartQueue ML utilise **Pytest**.
Des fichiers comme `test_e2e.py` et `test_anomalies.py` sont présents dans le répertoire `tests/` de l'application.

## 14.4 Pipeline CI (GitHub Actions)

Le fichier `.github/workflows/ci.yml` définit un pipeline d'intégration continue qui s'exécute à chaque Push ou Pull Request.
Bien que le détail exact de la pipeline ne soit pas documenté ici, l'infrastructure montre que des outils de linting (`eslint`, `ruff`, `mypy`) et de tests (`jest`, `pytest`) y sont intégrés de manière standard.
