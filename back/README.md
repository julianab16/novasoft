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

En Linux o macOS:

```bash
cd back
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con las credenciales reales de PostgreSQL
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Al ejecutar `createsuperuser`, registra el username y la contraseña que
usarás en el login. El superusuario puede acceder a las operaciones
administrativas. Para asignarle también el rol de negocio
`administrador`, abre el shell de Django:

```bash
python manage.py shell
```

```python
from accounts.models import User

list(User.objects.values_list("username", flat=True))
usuario = User.objects.get(username="EL_USERNAME_REGISTRADO")
usuario.full_name = "Administrador Principal"
usuario.document = "999999999"
usuario.role = User.Role.ADMINISTRADOR
usuario.save()
```

Obtén el token para probar la API:

```http
POST http://localhost:8000/api/auth/login/
Content-Type: application/json
```

```json
{
    "username": "EL_USERNAME_REGISTRADO",
    "password": "LA_CONTRASEÑA_REGISTRADA"
}
```

Usa el valor `access` de la respuesta como
`Authorization: Bearer <access>` en Postman.

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

Base URL: `http://localhost:8000`. Los endpoints protegidos requieren:

```http
Authorization: Bearer <access>
Content-Type: application/json
```

Las operaciones administrativas requieren el rol `administrador` o un
superusuario. Las respuestas de error siguen el formato
`{"error": ...}`.

### Autenticación

#### Iniciar sesión

```http
POST /api/auth/login/
```

Body:

```json
{"username": "admin", "password": "Admin12345"}
```

Salida `200`:

```json
{"refresh": "<refresh>", "access": "<access>"}
```

Una cuenta desactivada recibe `400` con `Usuario no activo.`. Las
credenciales incorrectas reciben `400` con `Credenciales inválidas.`.

#### Renovar token

```http
POST /api/auth/refresh/
```

Body:

```json
{"refresh": "<refresh>"}
```

Salida `200`:

```json
{"access": "<nuevo_access>"}
```

### Usuarios

Ruta base: `/api/accounts/users/`. Todas las operaciones requieren
administrador.

| Método y ruta | Body | Salida esperada |
| --- | --- | --- |
| `GET /api/accounts/users/` | Ninguno | `200`, lista de usuarios |
| `GET /api/accounts/users/{id}/` | Ninguno | `200`, usuario |
| `POST /api/accounts/users/` | Ver ejemplo | `201`, usuario creado |
| `PATCH /api/accounts/users/{id}/` | Campos a cambiar | `200`, usuario actualizado |
| `DELETE /api/accounts/users/{id}/` | Ninguno | `204`, usuario desactivado |

Body para crear:

```json
{
    "username": "operario01",
    "full_name": "Operario Uno",
    "document": "100000001",
    "role": "operario",
    "password": "Operario123"
}
```

Para cambiar el rol o reactivar una cuenta:

```json
{"role": "jefe_taller"}
```

```json
{"is_active": true}
```

Salida de usuario:

```json
{
    "id": 2,
    "username": "operario01",
    "full_name": "Operario Uno",
    "document": "100000001",
    "role": "operario",
    "is_active": true
}
```

#### Cerrar sesión

```http
POST /api/accounts/logout/
```

Body: ninguno. Salida `204`.

### Tipos de equipo

Ruta base: `/api/catalog/equipment-types/`. Requiere administrador.

| Método y ruta | Body | Salida esperada |
| --- | --- | --- |
| `GET /api/catalog/equipment-types/` | Ninguno | `200`, lista |
| `GET /api/catalog/equipment-types/{id}/` | Ninguno | `200`, tipo |
| `POST /api/catalog/equipment-types/` | Ver ejemplo | `201`, tipo creado |
| `PATCH /api/catalog/equipment-types/{id}/` | Ver ejemplo | `200`, tipo actualizado |
| `POST /api/catalog/equipment-types/{id}/deactivate/` | Ninguno | `200`, tipo desactivado |
| `DELETE /api/catalog/equipment-types/{id}/` | Ninguno | `204` si no tiene equipos; `400` si tiene equipos |

Body:

```json
{"name": "Compresor", "is_active": true}
```

### Equipos

Ruta base: `/api/catalog/equipments/`. Requiere administrador.

| Método y ruta | Body | Salida esperada |
| --- | --- | --- |
| `GET /api/catalog/equipments/` | Ninguno | `200`, lista |
| `GET /api/catalog/equipments/{identifier}/` | Ninguno | `200`, equipo |
| `POST /api/catalog/equipments/` | Ver ejemplo | `201`, equipo creado |
| `PATCH /api/catalog/equipments/{identifier}/` | Ver ejemplo | `200`, equipo actualizado e historial guardado |
| `DELETE /api/catalog/equipments/{identifier}/` | Ninguno | `204`, eliminado |

Body para crear o modificar:

```json
{
    "identifier": "COMP-001",
    "plate": "ABC123",
    "equipment_type": 1,
    "status": "usable",
    "model": "Atlas 2026"
}
```

### Categorías e ítems de inspección

Rutas base: `/api/catalog/item-categories/` y `/api/catalog/items/`.
Requieren administrador.

| Recurso | Métodos disponibles | Body de creación |
| --- | --- | --- |
| Categorías | `GET`, `POST`, `GET/{id}`, `PATCH/{id}`, `DELETE/{id}` | `{"name":"Motor", "is_active":true}` |
| Ítems | `GET`, `POST`, `GET/{identifier}`, `PATCH/{identifier}`, `DELETE/{identifier}` | `{"identifier":"ITEM-001", "name":"Revisar aceite", "category":1, "is_critical":true, "is_active":true}` |

Las operaciones exitosas de creación devuelven `201`, las modificaciones
`200` y las eliminaciones lógicas `204`.

Para crear un ítem que luego será incluido en una lista:

```http
POST /api/catalog/items/
```

```json
{
    "identifier": "ITEM-001",
    "name": "Revisar nivel de aceite",
    "category": 1,
    "is_critical": true,
    "is_active": true
}
```

Salida `201`:

```json
{
    "identifier": "ITEM-001",
    "name": "Revisar nivel de aceite",
    "category": 1,
    "is_critical": true,
    "is_active": true
}
```

El valor `identifier` se usa al crear la lista dentro de `item_orders`:

```json
{
    "item": "ITEM-001",
    "position": 1
}
```

### Listas de inspección

Ruta base: `/api/catalog/checklists/`. Requiere administrador.

| Método y ruta | Body | Salida esperada |
| --- | --- | --- |
| `GET /api/catalog/checklists/` | Ninguno | `200`, lista |
| `GET /api/catalog/checklists/{identifier}/` | Ninguno | `200`, lista |
| `POST /api/catalog/checklists/` | Ver ejemplo | `201`, lista versión 1 |
| `PATCH /api/catalog/checklists/{identifier}/` | Campos a cambiar | `200`, versión incrementada |
| `DELETE /api/catalog/checklists/{identifier}/` | Ninguno | `204` |

Body:

```json
{
    "identifier": "CHK-COMP-001",
    "name": "Inspección de compresor",
    "equipment_types": [1],
    "item_orders": [
        {"item": "ITEM-001", "position": 1}
    ],
    "is_active": true
}
```

Cada modificación incrementa `version`.

### Registros de inspección

Ruta base: `/api/inspections/records/`.

| Método y ruta | Body | Salida esperada |
| --- | --- | --- |
| `GET /api/inspections/records/` | Ninguno | `200`, inspecciones permitidas para el usuario |
| `GET /api/inspections/records/{id}/` | Ninguno | `200`, inspección |
| `POST /api/inspections/records/` | Ver ejemplo | `201`, inspección creada |
| `PATCH /api/inspections/records/{id}/` | Campos a cambiar | `200`, inspección actualizada |
| `DELETE /api/inspections/records/{id}/` | Ninguno | `204` |

Body para crear una inspección:

```json
{
    "equipment": "COMP-001",
    "checklist": "CHK-COMP-001",
    "status": "completed",
    "responses": [
        {"item": "ITEM-001", "result": "complies", "notes": "Sin novedades"}
    ]
}
```

El usuario autenticado se guarda como `performed_by` y la versión actual de
la lista como `checklist_version`.

### Documentación interactiva

- OpenAPI JSON: `GET /api/schema/`
- Swagger UI: `GET /api/docs/`

Las modificaciones de equipos conservan usuario y fecha mediante el historial
de `django-simple-history`.

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
