# SIGOPE · Front (Administración)

Vistas del administrador de SIGOPE hechas en **React + TypeScript + Vite + Tailwind CSS**:

- Inicio de sesión (con aviso de sesión vencida por inactividad)
- Usuarios y roles (usuarios, roles y permisos por módulo)
- Equipos y tipos de equipo
- Listas de inspección (una lista por tipo de equipo)
- Acceso denegado (cuando el rol no tiene permiso)

Todas las vistas son responsive (celular, tablet y computador).

## Cómo ejecutarlo

Se necesita Node.js 18 o superior.

```bash
npm install
cp .env.example .env
npm run dev
```

Se abre en `http://localhost:5173`.

- Con `VITE_API_URL=http://localhost:8000` (valor de `.env.example`) usa el **backend real** (ver `../back/README.md`). Se entra con el superusuario creado con `createsuperuser` (usuario o cédula).
- Con `VITE_API_URL` **vacía** funciona con **datos de prueba** en memoria (los tipos, equipos y listas del Excel del cliente). Para entrar: usuario `pgomez`, contraseña `Sigope2025`. Los cambios se pierden al recargar la página.

## Estructura

```
src/
├── App.tsx                 Login, control de sesión, menú y navegación
├── types.ts                Modelos de datos (Usuario, Rol, Equipo, ListaInspeccion…)
├── components/ui.tsx       Componentes y estilos compartidos
├── pages/                  Una vista por archivo
│   ├── Login.tsx
│   ├── CambiarClave.tsx    Cambio obligatorio de la contraseña temporal
│   ├── UsuariosRoles.tsx
│   ├── EquiposTipos.tsx
│   ├── ListasInspeccion.tsx
│   └── AccesoDenegado.tsx
└── services/
    ├── api.ts              ← Única puerta al backend (endpoints y traducción de campos)
    ├── mockApi.ts          Backend simulado (se usa si no hay VITE_API_URL)
    ├── mockData.ts         Datos de prueba
    └── ApiError.ts         Error que devuelve el backend
```

Las vistas **nunca** llaman a `fetch` directamente: todo pasa por `api.*` en `services/api.ts`.

## Cómo se conecta con el backend

`services/api.ts` es la única puerta al backend. El backend usa nombres en inglés (`full_name`, `identifier`…) y `api.ts` los traduce a los del front (`nombre`, `codigo`…) en ambos sentidos, **incluidos los errores por campo**: si el backend responde `{"error": {"document": ["Ya existe…"]}}`, la vista recibe el error en `documento` y lo muestra debajo del campo.

También se encarga de:

- Guardar el access y el refresh token del login y renovar el access token solo cuando vence.
- Volver al login si el backend rechaza la sesión y no se puede renovar.
- Invalidar el refresh token al cerrar sesión.

### Endpoints que usa

Todas las rutas van bajo `{VITE_API_URL}/api`. Las peticiones envían `Authorization: Bearer <token>`.

| Acción | Método y ruta |
|---|---|
| Iniciar sesión (usuario o cédula) | `POST /auth/login/` |
| Renovar token | `POST /auth/refresh/` |
| Cerrar sesión | `POST /accounts/logout/` |
| Cambiar la contraseña temporal | `POST /accounts/me/change-password/` |
| Listar / crear usuarios | `GET`, `POST /accounts/users/` |
| Editar / activar / desactivar usuario | `PATCH /accounts/users/{id}/` |
| Restablecer contraseña | `POST /accounts/users/{id}/reset-password/` |
| Listar / crear roles | `GET`, `POST /accounts/roles/` |
| Guardar permisos de un rol | `PUT /accounts/roles/{id}/permissions/` |
| Listar / crear tipos | `GET`, `POST /catalog/equipment-types/` |
| Editar / activar / eliminar tipo | `PATCH`, `DELETE /catalog/equipment-types/{id}/` |
| Listar / registrar equipos | `GET`, `POST /catalog/equipments/` |
| Editar equipo | `PATCH /catalog/equipments/{codigo}/` |
| Listar / crear listas | `GET`, `POST /catalog/checklists/` |
| Actualizar lista (nueva versión) | `PATCH /catalog/checklists/{id}/` |

El detalle de cada endpoint está en `../back/README.md` y en Swagger (`http://localhost:8000/api/docs/`).

### Reglas que valida el backend

El front también las valida, pero la fuente de verdad es el backend:

- No se repiten el **documento** ni el **usuario** de un usuario.
- No se repite el **código** ni la **placa** de un equipo, y el código no se puede cambiar.
- No se repite el **nombre** de un tipo de equipo ni de un rol.
- No se puede **eliminar** un tipo que tenga equipos.
- Cada tipo de equipo tiene **una sola** lista de inspección.
- Al **actualizar una lista** se crea una versión nueva; las inspecciones anteriores conservan la versión que respondieron.
- Un usuario desactivado no puede iniciar sesión y conserva su historial. Nadie puede desactivarse a sí mismo.
- El campo `modificado` de un equipo (usuario y fecha) lo llena el backend a partir del historial.
- El login responde con un mensaje genérico si falla (no dice si fue el usuario o la contraseña).
- Al crear un usuario o restablecer su contraseña, el backend genera una **contraseña temporal** que se muestra una sola vez al administrador; el usuario debe cambiarla en su primer ingreso.
- Los permisos del **Administrador** no se pueden cambiar: siempre tiene acceso total.

## Pendiente fuera de este front

- La app del operario (check-in, checklist, novedades) y los paneles de SST y Taller.
- El backend ya aplica los permisos por módulo de cada rol (el login los devuelve en `user.permissions`). Por ahora este front solo deja entrar al **Administrador**; los demás roles ven "Acceso denegado" hasta que existan sus pantallas.
