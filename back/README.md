# SIGOPE Backend

Backend modular de SIGOPE para gestionar usuarios, equipos, tipos de equipo,
listas de inspección e inspecciones. Esta implementación cubre el alcance
concretado en HU-01 a HU-06 del documento recibido.

## Tecnologías

- Python 3.12+
- Django 5.1 y Django REST Framework
- PostgreSQL
- JWT con SimpleJWT
- Grupos/permisos de Django y control de roles de negocio
- django-simple-history
- drf-spectacular (OpenAPI/Swagger)

## Puesta en marcha

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Configura PostgreSQL en `.env`; nunca uses el valor de desarrollo de
`DJANGO_SECRET_KEY` en producción.

## Autenticación

Obtén tokens en `POST /api/auth/login/`:

```json
{"username": "usuario", "password": "contraseña"}
```

Usa el token recibido en `Authorization: Bearer <access>`. El access token
expira según `JWT_ACCESS_MINUTES`; el refresh token se renueva en
`POST /api/auth/refresh/`.

## API

- Usuarios: `/api/accounts/users/` y `/api/accounts/logout/`
- Catálogo: `/api/catalog/equipment-types/`, `/equipments/`,
  `/item-categories/`, `/items/`, `/checklists/`
- Inspecciones: `/api/inspections/records/`
- OpenAPI JSON: `/api/schema/`
- Swagger UI: `/api/docs/`

Las operaciones administrativas requieren el rol `administrador`. La
desactivación es lógica y conserva el historial. Los tipos con equipos
asociados no pueden eliminarse físicamente porque la relación usa `PROTECT`.
Las modificaciones de listas incrementan su versión; las inspecciones guardan
la versión aplicada.

## Estructura

```text
config/        configuración, URLs y excepciones
accounts/      usuarios, roles, autenticación y administración de usuarios
catalog/       tipos, equipos, categorías, ítems y listas versionadas
inspections/   registros y respuestas de inspección
```

No se han creado archivos de pruebas, conforme al alcance solicitado. Los
módulos `maintenance`, `sst`, `documents`, `notifications` y `reports` fueron
identificados en la arquitectura, pero no tienen historias ni modelos
concretos en la especificación recibida y por eso no se implementan todavía.
