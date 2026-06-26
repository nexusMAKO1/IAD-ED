-- =============================================================================
-- PostgreSQL init script — IAD & SmartQueue AI
-- Exécuté automatiquement au premier démarrage du container
-- =============================================================================

-- Activer l'extension TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Activer UUID v4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Activer pgcrypto pour les fonctions cryptographiques
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Extensions initialisées : timescaledb, uuid-ossp, pgcrypto';
END $$;
