from django.conf import settings
from django.db import models

from catalog.models import Equipment, InspectionChecklist


class Inspection(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "En progreso"
        COMPLETED = "completed", "Completada"

    equipment = models.ForeignKey(Equipment, on_delete=models.PROTECT, related_name="inspections")
    checklist = models.ForeignKey(
        InspectionChecklist, on_delete=models.PROTECT, related_name="inspections"
    )
    checklist_version = models.PositiveIntegerField()
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    performed_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS)


class InspectionResponse(models.Model):
    class Result(models.TextChoices):
        COMPLIES = "complies", "Cumple"
        DOES_NOT_COMPLY = "does_not_comply", "No cumple"
        NOT_APPLICABLE = "not_applicable", "No aplica"

    inspection = models.ForeignKey(Inspection, on_delete=models.CASCADE, related_name="responses")
    item = models.ForeignKey("catalog.ChecklistItem", on_delete=models.PROTECT)
    result = models.CharField(max_length=20, choices=Result.choices)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("inspection", "item"), name="unique_inspection_response")
        ]
