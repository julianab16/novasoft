# Arquitectura

SIGOPE usa un monolito modular Django. Cada app representa un dominio y
expone modelos, serializadores y viewsets REST. La configuración transversal
vive en `config/`.

```mermaid
flowchart LR
  Client[Cliente React/PWA] --> API[Django REST API]
  API --> Auth[accounts: JWT y roles]
  API --> Catalog[catalog: catálogo y checklists]
  API --> Inspections[inspections: respuestas]
  Auth --> DB[(PostgreSQL)]
  Catalog --> DB
  Inspections --> DB
```

Las vistas reciben la petición, los serializadores validan el contrato y los
modelos mantienen integridad referencial. `simple-history` registra cambios
en usuarios, tipos, equipos, categorías, ítems y listas.
