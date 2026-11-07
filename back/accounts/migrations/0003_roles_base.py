from django.db import migrations

MODULES = (
    "inspections",
    "incidents",
    "maintenance",
    "sst",
    "documents",
    "reports",
    "users",
    "catalogs",
)


def perms(manage=(), view=()):
    return {
        m: "manage" if m in manage else "view" if m in view else "none" for m in MODULES
    }


BASE_ROLES = (
    ("operario", "Operario", perms(manage=("inspections", "incidents"))),
    (
        "jefe_taller",
        "Jefe de Taller",
        perms(manage=("maintenance",), view=("inspections", "incidents", "reports")),
    ),
    (
        "sst",
        "SST",
        perms(
            manage=("sst",),
            view=("inspections", "incidents", "maintenance", "documents", "reports"),
        ),
    ),
    ("administrador", "Administrador", perms(manage=MODULES)),
    ("solo_lectura", "Solo consulta", perms(view=MODULES)),
)


def seed(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for code, name, permissions in BASE_ROLES:
        Role.objects.get_or_create(
            code=code, defaults={"name": name, "is_base": True, "permissions": permissions}
        )


def unseed(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Role.objects.filter(code__in=[code for code, _, _ in BASE_ROLES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_roles_y_cambio_de_clave"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
