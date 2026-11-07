# SIGOPE

Sistema para gestionar usuarios, equipos, tipos de equipo, listas de
inspección e inspecciones.

El repositorio tiene dos partes independientes:

```text
SIGOPE/
├── back/    API REST en Django + Django REST Framework (PostgreSQL, JWT)
├── front/   Vistas de administración en React + TypeScript + Vite + Tailwind
└── docs/    Arquitectura y modelo de base de datos
```

Cada parte tiene su propio README con los detalles:

- [back/README.md](back/README.md): instalación, autenticación, endpoints y módulos.
- [front/README.md](front/README.md): ejecución, estructura, endpoints que espera y reglas de validación.
- [docs/architecture.md](docs/architecture.md) y [docs/database.md](docs/database.md).

## Puesta en marcha rápida

### Backend

Necesita Python 3.12+ y PostgreSQL.

```bash
cd back
python -m venv .venv
source .venv/bin/activate        # En Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env             # Configurar PostgreSQL y DJANGO_SECRET_KEY
python manage.py migrate
python manage.py cargar_datos_iniciales   # Tipos, equipos y listas del cliente
python manage.py createsuperuser          # Pide usuario, cédula y nombre; queda como Administrador
python manage.py runserver
```

La API queda en `http://localhost:8000` y la documentación Swagger en
`http://localhost:8000/api/docs/`.

## Integración continua (CI)

GitHub Actions ejecuta CI en cada push y pull request. El flujo valida la
configuración y las pruebas del backend con PostgreSQL, calcula su cobertura
y compila el frontend. El reporte de cobertura del backend queda disponible
como artefacto de la ejecución.

Para ejecutar las pruebas y consultar el porcentaje de cobertura localmente:

```bash
cd back
pip install -r requirements.txt
coverage run --source=accounts,catalog,inspections,config manage.py test
coverage report --show-missing
```

Las pruebas del backend cubren autenticación, usuarios y roles, permisos de
catálogos, versiones de listas, carga de datos iniciales e inspecciones. La
ejecución local validada encontró 40 pruebas y 93% de cobertura del backend;
CI requiere un mínimo de 90%. El porcentaje puede variar al agregar o modificar
código. Las pruebas crean sus propios datos temporales, incluido un usuario
con rol Administrador, y no crean usuarios en tu base local.

### Frontend

Necesita Node.js 18+.

```bash
cd front
npm install
cp .env.example .env             # Ya trae VITE_API_URL=http://localhost:8000
npm run dev
```

Se abre en `http://localhost:5173` y se entra con el superusuario (usuario o
cédula). El backend permite peticiones desde ese origen (CORS) por defecto.
Si `VITE_API_URL` se deja vacía, el front funciona con datos de prueba (ver
[front/README.md](front/README.md)).
