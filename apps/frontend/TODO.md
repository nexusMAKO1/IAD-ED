# Missing Backend Endpoints

The following endpoints are required by the frontend but are currently not implemented on the backend API.

## 1. Sites Creation
**Method**: `POST`
**Path**: `/api/v1/sites`
**Payload Attendu**:
```json
{
  "name": "string",
  "address": "string",
  "timezone": "string",
  "operatingHours": {
    "open": "string (HH:mm)",
    "close": "string (HH:mm)"
  }
}
```

## 2. Sites Deletion
**Method**: `DELETE`
**Path**: `/api/v1/sites/:id`
**Payload Attendu**: Aucun.

## 3. Demographics Breakdown
**Method**: `GET`
**Path**: `/api/v1/sites/:id/demographics`
**Payload Attendu**: Aucun. Retourne une agrégation des données démographiques (répartition par âge, genre, heures de pointe) pour alimenter les graphiques de la page Audience.

## 4. Visitor Time Series
**Method**: `GET`
**Path**: `/api/v1/sites/:id/timeseries?granularity=minute|hour|day`
**Payload Attendu**: Aucun. Retourne les données temporelles pour les graphiques de type ligne (VisitorLineChart).

## 5. Change Password
**Method**: `POST`
**Path**: `/api/v1/auth/change-password`
**Payload Attendu**:
```json
{
  "oldPassword": "...",
  "newPassword": "..."
}
```

## Note sur le Monitoring
Le check de santé `GET http://localhost:3000/health` peut échouer en développement si les règles CORS du backend ne l'autorisent pas. Il faudra s'assurer que le backend expose les bons headers CORS pour cet endpoint.
