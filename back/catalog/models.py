from django.conf import settings
from django.db import models
from simple_history.models import HistoricalRecords


class EquipmentType(models.Model):
    name = models.CharField("nombre del tipo", max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ("name",)
        verbose_name = "tipo de equipo"
        verbose_name_plural = "tipos de equipo"

    def __str__(self):
        return self.name


class Equipment(models.Model):
    class Status(models.TextChoices):
        USABLE = "usable", "Usable"
        NOT_USABLE = "no_usable", "No usable"

    identifier = models.CharField("identificador", max_length=50, primary_key=True)
    plate = models.CharField("placa", max_length=30, blank=True)
    equipment_type = models.ForeignKey(
        EquipmentType, on_delete=models.PROTECT, related_name="equipments"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.USABLE)
    model = models.CharField("modelo", max_length=100)
    history = HistoricalRecords()

    class Meta:
        ordering = ("identifier",)

    def __str__(self):
        return self.identifier


class ItemCategory(models.Model):
    name = models.CharField("nombre categoría item", max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name


class ChecklistItem(models.Model):
    identifier = models.CharField("identificador item", max_length=50, primary_key=True)
    name = models.CharField(max_length=200)
    category = models.ForeignKey(ItemCategory, on_delete=models.PROTECT, related_name="items")
    is_critical = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name


class InspectionChecklist(models.Model):
    identifier = models.CharField("identificador", max_length=50, primary_key=True)
    name = models.CharField(max_length=150)
    equipment_types = models.ManyToManyField(EquipmentType, related_name="checklists")
    items = models.ManyToManyField(
        ChecklistItem, through="ChecklistItemOrder", related_name="checklists"
    )
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    history = HistoricalRecords()

    def __str__(self):
        return f"{self.name} v{self.version}"


class ChecklistItemOrder(models.Model):
    checklist = models.ForeignKey(InspectionChecklist, on_delete=models.CASCADE)
    item = models.ForeignKey(ChecklistItem, on_delete=models.PROTECT)
    position = models.PositiveIntegerField()

    class Meta:
        ordering = ("position",)
        constraints = [
            models.UniqueConstraint(fields=("checklist", "item"), name="unique_checklist_item"),
            models.UniqueConstraint(fields=("checklist", "position"), name="unique_item_position"),
        ]
