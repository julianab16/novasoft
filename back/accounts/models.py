from django.contrib.auth.models import AbstractUser
from django.db import models
from simple_history.models import HistoricalRecords


class User(AbstractUser):
    class Role(models.TextChoices):
        OPERARIO = "operario", "Operario"
        JEFE_TALLER = "jefe_taller", "Jefe de Taller"
        SST = "sst", "Encargado de SST"
        ADMINISTRADOR = "administrador", "Administrador"
        LECTURA = "solo_lectura", "Solo consulta"

    document = models.CharField("cédula de identidad", max_length=30, unique=True)
    full_name = models.CharField("nombre completo", max_length=150)
    role = models.CharField(max_length=30, choices=Role.choices, default=Role.OPERARIO)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        self.username = self.username.strip().lower()
        self.full_name = self.full_name.strip()
        self.document = self.document.strip()
        super().save(*args, **kwargs)
