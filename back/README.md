# SIGOPE Backend

Backend modular de SIGOPE para gestionar usuarios, equipos, tipos de equipo,
listas de inspección e inspecciones. Esta implementación cubre el alcance
concretado en HU-01 a HU-06 del documento recibido y el contrato que usa el
front de administración (`../front`).

## Tecnologías

- Python 3.12+
- Django 5.2 y Django REST Framework
- PostgreSQL
- JWT con SimpleJWT (con lista negra de refresh tokens al cerrar sesión)
- Roles con permisos por módulo
- django-simple-history
- drf-spectacular (OpenAPI/Swagger)
- django-cors-headers (para que el front pueda llamar a la API)

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
python manage.py cargar_datos_iniciales   # tipos, equipos y listas del cliente (opcional)
python manage.py createsuperuser
python manage.py runserver
```

`migrate` crea los roles base (Operario, Jefe de Taller, SST, Administrador y
Solo consulta). `createsuperuser` pide usuario, cédula, nombre completo y
contraseña, y deja al superusuario con el rol **Administrador**; con ese
usuario (o su cédula) se entra al front.

`cargar_datos_iniciales` carga los 3 tipos de equipo, 21 equipos y 3 listas de
inspección del Excel "CONTROL PREOPERACIONAL EQUIPOS MÓVILES - TCHO"
(`catalog/fixtures/datos_iniciales.json`). Se puede ejecutar varias veces: no
duplica lo que ya existe.

Variables de `.env`:

| Variable | Uso |
| --- | --- |
| `DJANGO_SECRET_KEY` | Clave secreta. Nunca uses el valor de ejemplo en producción. |
| `DJANGO_DEBUG` | `True` solo en desarrollo. |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos, separados por coma. |
| `POSTGRES_*` o `DATABASE_URL` | Conexión a la base de datos. |
| `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS` | Duración de los tokens. |
| `CORS_ALLOWED_ORIGINS` | URLs del front que pueden llamar a la API (por defecto `http://localhost:5173`). |

## Autenticación y permisos

Obtén tokens en `POST /api/auth/login/` con el usuario **o la cédula** y la
contraseña. Usa el token recibido en `Authorization: Bearer <access>`. El
access token expira según `JWT_ACCESS_MINUTES`; se renueva con el refresh en
`POST /api/auth/refresh/` (el front lo hace solo).

Cada rol tiene, por módulo, un nivel: `none` (sin acceso), `view` (solo ver)
o `manage` (ver y gestionar). Leer exige `view` o `manage`; crear, editar o
eliminar exige `manage`. El rol Administrador y los superusuarios siempre
tienen acceso total.

| Módulo (`code`) | Nombre en el front | Endpoints que protege |
| --- | --- | --- |
| `users` | Usuarios y roles | `/api/accounts/users/`, `/api/accounts/roles/` |
| `catalogs` | Catálogos y listas | `/api/catalog/...` (también se pueden **leer** con acceso a `inspections`) |
| `inspections` | Inspecciones | `/api/inspections/records/` |
| `incidents`, `maintenance`, `sst`, `documents`, `reports` | Resto de módulos | Reservados para próximas historias |

Las respuestas de error siguen el formato `{"error": {...}}`. Los errores de
un campo vienen con el nombre del campo; los generales, en `detail` o
`non_field_errors`:

```json
{"error": {"document": ["Ya existe un usuario con este documento."]}}
```

## API

Base URL: `http://localhost:8000`. Los endpoints protegidos requieren:

```http
Authorization: Bearer <access>
Content-Type: application/json
```

### Sesión

| Método y ruta | Body | Salida |
| --- | --- | --- |
| `POST /api/auth/login/` | `{"username": "pgomez", "password": "..."}` (`username` acepta la cédula) | `200`, ver abajo |
| `POST /api/auth/refresh/` | `{"refresh": "<refresh>"}` | `200`, `{"access": "<nuevo>"}` |
| `POST /api/accounts/logout/` | `{"refresh": "<refresh>"}` (opcional) | `204`; el refresh queda invalidado |
| `GET /api/accounts/me/` | Ninguno | `200`, datos del usuario autenticado |
| `POST /api/accounts/me/change-password/` | `{"current_password": "...", "new_password": "..."}` | `204` |

Salida del login:

```json
{
    "refresh": "<refresh>",
    "access": "<access>",
    "user": {
        "id": 1,
        "username": "pgomez",
        "full_name": "Patricia Gómez",
        "document": "66851230",
        "role": "administrador",
        "role_name": "Administrador",
        "is_admin": true,
        "must_change_password": false,
        "permissions": {"inspections": "manage", "users": "manage", "...": "..."}
    }
}
```

Las credenciales incorrectas reciben `400` con `Credenciales inválidas.`
(sin decir si falló el usuario o la contraseña). Una cuenta desactivada,
con la contraseña correcta, recibe `400` con `Usuario no activo.`.

Si `must_change_password` es `true` (contraseña temporal), el front pide
cambiarla con `me/change-password/` antes de continuar.

### Usuarios

Ruta base: `/api/accounts/users/`. Módulo `users`.

| Método y ruta | Body | Salida esperada |
| --- | --- | --- |
| `GET /api/accounts/users/` | Ninguno | `200`, lista (filtros `?role=`, `?is_active=`, `?search=`) |
| `GET /api/accounts/users/{id}/` | Ninguno | `200`, usuario |
| `POST /api/accounts/users/` | Ver ejemplo | `201`, usuario creado |
| `PATCH /api/accounts/users/{id}/` | Campos a cambiar | `200`, usuario actualizado |
| `DELETE /api/accounts/users/{id}/` | Ninguno | `204`, usuario desactivado (conserva su historial) |
| `POST /api/accounts/users/{id}/reset-password/` | Ninguno | `200`, `{"temporary_password": "..."}` |

Body para crear (`password` es opcional):

```json
{
    "username": "operario01",
    "full_name": "Operario Uno",
    "document": "100000001",
    "role": "operario"
}
```

Si no se envía `password`, se genera una contraseña temporal y la respuesta
la incluye una sola vez en `temporary_password`. Todo usuario creado o con
contraseña restablecida por un administrador debe cambiarla al ingresar.

Salida de usuario:

```json
{
    "id": 2,
    "username": "operario01",
    "full_name": "Operario Uno",
    "document": "100000001",
    "role": "operario",
    "role_name": "Operario",
    "is_active": true,
    "must_change_password": true
}
```

No se repiten `username` ni `document`, y un usuario no puede desactivarse a
sí mismo.

### Roles

Ruta base: `/api/accounts/roles/`. Módulo `users`.

| Método y ruta | Body | Salida esperada |
| --- | --- | --- |
| `GET /api/accounts/roles/` | Ninguno | `200`, lista |
| `POST /api/accounts/roles/` | `{"name": "Auditor", "read_only": true}` | `201`; con `read_only` empieza en `view` en todos los módulos, si no en `none` |
| `PATCH /api/accounts/roles/{id}/` | `{"name": "..."}` | `200` (los roles base no se renombran) |
| `PUT /api/accounts/roles/{id}/permissions/` | `{"inspections": "view", "catalogs": "manage"}` | `200`; los módulos omitidos quedan en `none` |
| `DELETE /api/accounts/roles/{id}/` | Ninguno | `204` si no es base y no tiene usuarios |

Salida de rol:

```json
{
    "id": 6,
    "code": "auditor",
    "name": "Auditor",
    "is_base": false,
    "permissions": {"inspections": "view", "incidents": "view", "...": "..."},
    "user_count": 0
}
```

Los permisos del Administrador no se pueden modificar.

### Tipos de equipo

Ruta base: `/api/catalog/equipment-types/`. Módulo `catalogs`.

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
{"name": "Compresor", "description": "Compresores Kaishan y Atlas Copco", "is_active": true}
```

La salida incluye además `equipment_count`. El nombre no se repite (sin
distinguir mayúsculas). Al eliminar un tipo, su lista de inspección también
se elimina (o se desactiva si ya tiene inspecciones).

### Equipos

Ruta base: `/api/catalog/equipments/`. Módulo `catalogs`.

| Método y ruta | Body | Salida esperada |
| --- | --- | --- |
| `GET /api/catalog/equipments/` | Ninguno | `200`, lista |
| `GET /api/catalog/equipments/{identifier}/` | Ninguno | `200`, equipo |
| `POST /api/catalog/equipments/` | Ver ejemplo | `201`, equipo creado |
| `PATCH /api/catalog/equipments/{identifier}/` | Ver ejemplo | `200`, equipo actualizado e historial guardado |
| `DELETE /api/catalog/equipments/{identifier}/` | Ninguno | `204`, eliminado (`400` si tiene inspecciones) |

Body para crear o modificar:

```json
{
    "identifier": "CAR-1",
    "plate": "ABC123",
    "equipment_type": 1,
    "status": "usable",
    "model": "Caterpillar 966C",
    "serial_number": "18B01190",
    "year": 1990,
    "hour_meter": "6509"
}
```

`status` puede ser `usable` (Disponible), `en_mantenimiento` (En
mantenimiento) o `no_usable` (Fuera de servicio). El `identifier` se guarda
en mayúsculas, no se repite y no se puede cambiar después de crear el equipo;
la placa tampoco se repite. La salida incluye además `equipment_type_name`,
`status_display`, `last_modified_by` y `last_modified_at` (último cambio,
tomado del historial).

### Categorías e ítems de inspección

Rutas base: `/api/catalog/item-categories/` y `/api/catalog/items/`.
Módulo `catalogs`.

| Recurso | Métodos disponibles | Body de creación |
| --- | --- | --- |
| Categorías | `GET`, `POST`, `GET/{id}`, `PATCH/{id}`, `DELETE/{id}` | `{"name":"Motor", "is_active":true}` |
| Ítems | `GET`, `POST`, `GET/{identifier}`, `PATCH/{identifier}`, `DELETE/{identifier}` | `{"identifier":"ITEM-001", "name":"Revisar aceite", "category":1, "is_critical":true, "is_active":true}` |

Normalmente no hace falta usarlos directamente: al guardar una lista por
secciones, las categorías e ítems se crean solos.

### Listas de inspección

Ruta base: `/api/catalog/checklists/`. Módulo `catalogs`.

| Método y ruta | Body | Salida esperada |
| --- | --- | --- |
| `GET /api/catalog/checklists/` | Ninguno | `200`, lista |
| `GET /api/catalog/checklists/{identifier}/` | Ninguno | `200`, lista |
| `GET /api/catalog/checklists/{identifier}/versions/` | Ninguno | `200`, contenido de cada versión |
| `POST /api/catalog/checklists/` | Ver ejemplo | `201`, lista versión 1 |
| `PATCH /api/catalog/checklists/{identifier}/` | Campos a cambiar | `200`, versión incrementada si cambió el contenido |
| `DELETE /api/catalog/checklists/{identifier}/` | Ninguno | `204` (`400` si tiene inspecciones) |

Body (solo `equipment_types` es obligatorio; `identifier` y `name` se generan
si no se envían):

```json
{
    "equipment_types": [1],
    "sections": [
        {"title": "Motor", "items": [
            {"text": "Nivel de aceite", "is_critical": true},
            {"text": "Fugas"}
        ]},
        {"title": "Luces", "items": [{"text": "Luces delanteras"}]}
    ]
}
```

Cada título de sección es una categoría y cada texto un ítem. También se
puede enviar el contenido como `item_orders` (`[{"item": "ITEM-001",
"position": 1}]`) con ítems ya creados.

Reglas:

- Cada tipo de equipo tiene **una sola** lista.
- Cambiar el nombre o el contenido crea una **versión nueva**. Los ítems no se
  editan en sitio: si cambia el texto se crea un ítem nuevo, así las
  inspecciones anteriores conservan las preguntas que respondieron. El
  contenido de cada versión queda en `versions/`.

### Registros de inspección

Ruta base: `/api/inspections/records/`. Módulo `inspections`.

| Método y ruta | Body | Salida esperada |
| --- | --- | --- |
| `GET /api/inspections/records/` | Ninguno | `200`, inspecciones permitidas para el usuario |
| `GET /api/inspections/records/{id}/` | Ninguno | `200`, inspección |
| `POST /api/inspections/records/` | Ver ejemplo | `201`, inspección creada |
| `PATCH /api/inspections/records/{id}/` | `{"status": "completed"}` | `200`; solo cambia el estado |
| `DELETE /api/inspections/records/{id}/` | Ninguno | `204` |

Body para crear una inspección:

```json
{
    "equipment": "CAR-1",
    "checklist": "CHK-CARGADORES",
    "status": "completed",
    "responses": [
        {"item": "ITM-06EEB96E11", "result": "complies", "notes": "Sin novedades"}
    ]
}
```

Hay que responder todos los ítems de la versión actual de la lista. El
usuario autenticado se guarda como `performed_by` y la versión como
`checklist_version`. Administrador, Jefe de Taller, SST y los roles con
"Solo ver" en Inspecciones ven todas; los demás, solo las suyas.

### Documentación interactiva

- OpenAPI JSON: `GET /api/schema/`
- Swagger UI: `GET /api/docs/`

Las modificaciones de equipos conservan usuario y fecha mediante el historial
de `django-simple-history`.

## Estructura

```text
config/        configuración, URLs y excepciones
accounts/      usuarios, roles y permisos, autenticación y contraseñas
catalog/       tipos, equipos, categorías, ítems y listas versionadas
               (management/commands/cargar_datos_iniciales.py y fixtures/)
inspections/   registros y respuestas de inspección
```

No se han creado archivos de pruebas, conforme al alcance solicitado. Los
módulos `maintenance`, `sst`, `documents`, `notifications` y `reports` fueron
identificados en la arquitectura, pero no tienen historias ni modelos
concretos en la especificación recibida y por eso no se implementan todavía.
