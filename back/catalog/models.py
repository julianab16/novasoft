from django.conf import settings
from django.db import models
from simple_history.models import HistoricalRecords


class EquipmentType(models.Model):
    name = models.CharField(
        "nombre del tipo",
        max_length=100,
        unique=True,
        error_messages={"unique": "Ya existe un tipo con este nombre."},
    )
    description = models.TextField("descripción", blank=True, default="", db_default="")
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
        USABLE = "usable", "Disponible"
        MAINTENANCE = "en_mantenimiento", "En mantenimiento"
        NOT_USABLE = "no_usable", "Fuera de servicio"

    identifier = models.CharField(
        "identificador",
        max_length=50,
        primary_key=True,
        error_messages={"unique": "Ya existe un equipo con este código o placa."},
    )
    plate = models.CharField("placa", max_length=30, blank=True)
    equipment_type = models.ForeignKey(
        EquipmentType, on_delete=models.PROTECT, related_name="equipments"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.USABLE)
    model = models.CharField("marca / modelo", max_length=100)
    serial_number = models.CharField(
        "número de serie", max_length=60, blank=True, default="", db_default=""
    )
    year = models.PositiveSmallIntegerField("año", null=True, blank=True)
    hour_meter = models.CharField(
        "horómetro",
        max_length=20,
        blank=True,
        default="",
        db_default="",
        help_text="Horas, o 'SM/SS' si no tiene medidor.",
    )
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

    def sections(self):
        """Ítems agrupados en secciones consecutivas según su categoría, en orden."""
        sections = []
        orders = self.checklistitemorder_set.select_related("item__category").order_by("position")
        for order in orders:
            item = order.item
            if not sections or sections[-1]["category_id"] != item.category_id:
                sections.append({"category_id": item.category_id, "title": item.category.name, "items": []})
            sections[-1]["items"].append(
                {"identifier": item.identifier, "text": item.name, "is_critical": item.is_critical}
            )
        return [{"title": s["title"], "items": s["items"]} for s in sections]


class ChecklistVersion(models.Model):
    """Copia fija del contenido de cada versión de una lista.

    Las inspecciones guardan `checklist_version`; con esta tabla se puede ver
    exactamente qué preguntas tenía la lista cuando se respondió.
    """

    checklist = models.ForeignKey(
        InspectionChecklist, on_delete=models.CASCADE, related_name="versions"
    )
    version = models.PositiveIntegerField()
    name = models.CharField(max_length=150)
    sections = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        ordering = ("-version",)
        constraints = [
            models.UniqueConstraint(fields=("checklist", "version"), name="unique_checklist_version")
        ]


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
