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
npm run dev
```

Se abre en `http://localhost:5173`.

Mientras no haya backend, el front funciona con **datos de prueba** (los tipos, equipos y listas del Excel del cliente).
Para entrar: usuario `pgomez`, contraseña `Sigope2025`.
Los cambios se pierden al recargar la página.

## Estructura

```
src/
├── App.tsx                 Login, control de sesión, menú y navegación
├── types.ts                Modelos de datos (Usuario, Rol, Equipo, ListaInspeccion…)
├── components/ui.tsx       Componentes y estilos compartidos
├── pages/                  Una vista por archivo
│   ├── Login.tsx
│   ├── UsuariosRoles.tsx
│   ├── EquiposTipos.tsx
│   ├── ListasInspeccion.tsx
│   └── AccesoDenegado.tsx
└── services/
    ├── api.ts              ← Única puerta al backend (endpoints)
    ├── mockApi.ts          Backend simulado (se usa si no hay VITE_API_URL)
    ├── mockData.ts         Datos de prueba
    └── ApiError.ts         Error que devuelve el backend
```

Las vistas **nunca** llaman a `fetch` directamente: todo pasa por `api.*` en `services/api.ts`.

## Cómo conectarlo con el backend

1. Copiar `.env.example` como `.env` y poner la URL del backend:

   ```
   VITE_API_URL=http://localhost:8000
   VITE_SESION_MINUTOS=15
   ```

2. Al tener `VITE_API_URL`, el front deja de usar los datos de prueba y llama a los endpoints de abajo.
3. Si el backend usa otras rutas o nombres de campos, se cambian **solo** en `services/api.ts` y `types.ts`.
4. El backend debe permitir CORS desde la URL del front (en Django: `django-cors-headers`).

### Endpoints que espera el front

Todas las rutas van bajo `{VITE_API_URL}/api`. Las peticiones envían `Authorization: Bearer <token>`.

| Acción | Método y ruta | Envía | Responde |
|---|---|---|---|
| Iniciar sesión | `POST /auth/login/` | `{ usuario, clave }` | `{ token, nombre, usuario, rol }` |
| Cerrar sesión | `POST /auth/logout/` | — | — |
| Listar usuarios | `GET /usuarios/` | — | `Usuario[]` |
| Crear usuario | `POST /usuarios/` | `Usuario` sin `id` | `Usuario` |
| Editar / activar / desactivar | `PATCH /usuarios/{id}/` | campos a cambiar | `Usuario` |
| Restablecer contraseña | `POST /usuarios/{id}/restablecer-clave/` | — | — |
| Listar roles | `GET /roles/` | — | `Rol[]` |
| Crear rol | `POST /roles/` | `{ nombre, solo_consulta }` | `Rol` |
| Guardar permisos | `PUT /roles/{id}/permisos/` | `{ "Inspecciones": "Solo ver", … }` | `Rol` |
| Listar tipos | `GET /tipos-equipo/` | — | `TipoEquipo[]` |
| Crear tipo | `POST /tipos-equipo/` | `{ nombre, descripcion, activo }` | `TipoEquipo` |
| Editar / activar tipo | `PATCH /tipos-equipo/{id}/` | campos a cambiar | `TipoEquipo` |
| Eliminar tipo | `DELETE /tipos-equipo/{id}/` | — | `204` |
| Listar equipos | `GET /equipos/` | — | `Equipo[]` |
| Registrar equipo | `POST /equipos/` | `Equipo` sin `id` ni `modificado` | `Equipo` |
| Editar equipo | `PATCH /equipos/{id}/` | campos a cambiar | `Equipo` |
| Listar listas | `GET /listas-inspeccion/` | — | `ListaInspeccion[]` |
| Crear lista | `POST /listas-inspeccion/` | `{ tipo }` | `ListaInspeccion` |
| Actualizar lista | `PUT /listas-inspeccion/{id}/` | `{ secciones }` | `ListaInspeccion` |

La forma de cada objeto está en `src/types.ts`.

### Reglas que debe validar el backend

El front ya las valida, pero el backend debe hacerlo también:

- No se repiten el **documento** ni el **usuario** de un usuario.
- No se repite el **código o placa** de un equipo.
- No se repite el **nombre** de un tipo de equipo.
- No se puede **eliminar** un tipo que tenga equipos.
- Cada tipo de equipo tiene **una sola** lista de inspección.
- Al **actualizar una lista** se crea una versión nueva; las inspecciones anteriores conservan la versión que respondieron.
- Un usuario desactivado no puede iniciar sesión y conserva su historial.
- El campo `modificado` de un equipo (usuario y fecha) lo llena el backend.
- El login responde con un mensaje genérico si falla (no dice si fue el usuario o la contraseña).

### Errores

Si algo falla, el backend debe responder con el formato de Django REST Framework, por ejemplo:

```json
{ "documento": ["Ya existe un usuario con este documento."] }
```

El front muestra ese mensaje debajo del campo correspondiente.

## Pendiente fuera de este front

- La app del operario (check-in, checklist, novedades) y los paneles de SST y Taller.
- Los permisos por rol se guardan aquí, pero cada pantalla debe revisarlos según el rol que devuelva el login. Por ahora este front solo deja entrar al rol **Administrador**; los demás ven "Acceso denegado".
