from django.contrib.auth.models import AbstractUser, UserManager as BaseUserManager
from django.db import models


class Module(models.TextChoices):
    """Módulos del sistema sobre los que se asignan permisos por rol."""

    INSPECTIONS = "inspections", "Inspecciones"
    INCIDENTS = "incidents", "Novedades e incidentes"
    MAINTENANCE = "maintenance", "Mantenimientos"
    SST = "sst", "Seguimiento SST"
    DOCUMENTS = "documents", "Documentos"
    REPORTS = "reports", "Reportes y tableros"
    USERS = "users", "Usuarios y roles"
    CATALOGS = "catalogs", "Catálogos y listas"


class AccessLevel(models.TextChoices):
    NONE = "none", "Sin acceso"
    VIEW = "view", "Solo ver"
    MANAGE = "manage", "Ver y gestionar"


def permissions_with(manage=(), view=()):
    """Arma el diccionario de permisos completo: lo no indicado queda sin acceso."""
    return {
        module: (
            AccessLevel.MANAGE
            if module in manage
            else AccessLevel.VIEW if module in view else AccessLevel.NONE
        ).value
        for module in Module.values
    }


class Role(models.Model):
    code = models.SlugField("código", max_length=30, unique=True)
    name = models.CharField(
        "nombre",
        max_length=60,
        unique=True,
        error_messages={"unique": "Ya existe un rol con este nombre."},
    )
    is_base = models.BooleanField("rol base", default=False)
    permissions = models.JSONField("permisos por módulo", default=dict)

    class Meta:
        ordering = ("-is_base", "id")
        verbose_name = "rol"
        verbose_name_plural = "roles"

    def __str__(self):
        return self.name

    def level_for(self, module):
        return self.permissions.get(module, AccessLevel.NONE)


class UserManager(BaseUserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("role", "administrador")
        return super().create_superuser(username, email, password, **extra_fields)


# Alias: dentro de User, `Role` es la clase de opciones con los códigos base.
RoleModel = Role


class User(AbstractUser):
    class Role(models.TextChoices):
        """Códigos de los roles base. Los roles adicionales viven en el modelo Role."""

        OPERARIO = "operario", "Operario"
        JEFE_TALLER = "jefe_taller", "Jefe de Taller"
        SST = "sst", "SST"
        ADMINISTRADOR = "administrador", "Administrador"
        LECTURA = "solo_lectura", "Solo consulta"

    document = models.CharField(
        "cédula de identidad",
        max_length=30,
        unique=True,
        error_messages={"unique": "Ya existe un usuario con este documento."},
    )
    full_name = models.CharField("nombre completo", max_length=150)
    # Código de un registro de `accounts.Role`; se valida en el serializer.
    role = models.CharField(max_length=30, default=Role.OPERARIO)
    is_active = models.BooleanField(default=True)
    must_change_password = models.BooleanField(
        "debe cambiar la contraseña", default=False, db_default=False
    )

    objects = UserManager()
    REQUIRED_FIELDS = ["document", "full_name"]

    @property
    def is_admin(self):
        return self.is_superuser or self.role == User.Role.ADMINISTRADOR

    @property
    def role_record(self):
        if not hasattr(self, "_role_record"):
            self._role_record = RoleModel.objects.filter(code=self.role).first()
        return self._role_record

    @property
    def role_name(self):
        return self.role_record.name if self.role_record else self.role

    def access_level(self, module):
        if self.is_admin:
            return AccessLevel.MANAGE
        return self.role_record.level_for(module) if self.role_record else AccessLevel.NONE

    def permissions_map(self):
        return {module: self.access_level(module) for module in Module.values}

    def save(self, *args, **kwargs):
        self.username = self.username.strip().lower()
        self.full_name = self.full_name.strip()
        self.document = self.document.strip()
        self.__dict__.pop("_role_record", None)
        super().save(*args, **kwargs)

