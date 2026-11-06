# Base de datos

## Entidades

- `accounts_user`: usuario, documento único, nombre, rol y estado.
- `catalog_equipmenttype`: tipo de equipo activo/inactivo.
- `catalog_equipment`: identificador PK, placa, tipo protegido, estado y modelo.
- `catalog_itemcategory`: categoría de ítem.
- `catalog_checklistitem`: ítem, categoría, criticidad y estado.
- `catalog_inspectionchecklist`: lista, versión, tipos asociados e ítems.
- `catalog_checklistitemorder`: relación ordenada entre lista e ítem.
- `inspections_inspection`: equipo, lista, versión aplicada, usuario, fecha y estado.
- `inspections_inspectionresponse`: resultado por ítem y observaciones.

Los cambios de entidades auditables generan tablas históricas mediante
`django-simple-history`. Las migraciones se generan con:

```powershell
python manage.py makemigrations
python manage.py migrate
```

Las relaciones con entidades históricas o inspecciones usan `PROTECT` cuando
la eliminación rompería trazabilidad. La eliminación de tipos, categorías y
usuarios se realiza de forma lógica desde la API.
