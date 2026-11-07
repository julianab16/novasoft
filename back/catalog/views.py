from django.db import transaction
from django.db.models import Count, OuterRef, Subquery
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response

from accounts.models import AccessLevel, Module

from .models import (
    ChecklistItem,
    Equipment,
    EquipmentType,
    InspectionChecklist,
    ItemCategory,
)
from .serializers import (
    ChecklistItemSerializer,
    ChecklistVersionSerializer,
    EquipmentSerializer,
    EquipmentTypeSerializer,
    InspectionChecklistSerializer,
    ItemCategorySerializer,
)


class CatalogPermission(BasePermission):
    """Gestionar catálogos exige "Ver y gestionar" en Catálogos y listas.

    Consultar se permite también a quien tiene acceso a Inspecciones, porque el
    operario necesita ver equipos y listas para hacer el check-in.
    """

    message = "Acceso denegado."
    read_modules = (Module.CATALOGS, Module.INSPECTIONS)

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return any(
                user.access_level(m) in (AccessLevel.VIEW, AccessLevel.MANAGE)
                for m in self.read_modules
            )
        return user.access_level(Module.CATALOGS) == AccessLevel.MANAGE


class CatalogModelViewSet(viewsets.ModelViewSet):
    permission_classes = (CatalogPermission,)


# Se mantiene el nombre anterior por compatibilidad.
AdminModelViewSet = CatalogModelViewSet


class EquipmentTypeViewSet(CatalogModelViewSet):
    queryset = EquipmentType.objects.annotate(equipment_count=Count("equipments"))
    serializer_class = EquipmentTypeSerializer
    search_fields = ("name",)
    filterset_fields = ("is_active",)

    @action(detail=True, methods=("post",))
    def deactivate(self, request, pk=None):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def perform_destroy(self, instance):
        if instance.equipments.exists():
            raise ValidationError(
                {"detail": "No se puede eliminar un tipo de equipo con equipos asociados."}
            )
        # La lista que solo usaba este tipo se elimina (o se desactiva si ya tiene inspecciones).
        for checklist in instance.checklists.all():
            if checklist.equipment_types.count() > 1:
                continue
            if checklist.inspections.exists():
                checklist.is_active = False
                checklist.save(update_fields=["is_active"])
            else:
                checklist.delete()
        instance.delete()


class EquipmentViewSet(CatalogModelViewSet):
    lookup_value_regex = "[^/]+"  # los códigos pueden tener puntos o espacios
    serializer_class = EquipmentSerializer
    search_fields = ("identifier", "plate", "model", "serial_number")
    filterset_fields = ("equipment_type", "status")

    def get_queryset(self):
        latest = Equipment.history.model.objects.filter(identifier=OuterRef("pk")).order_by(
            "-history_date"
        )
        return Equipment.objects.select_related("equipment_type").annotate(
            last_modified_on=Subquery(latest.values("history_date")[:1]),
            last_modified_by_name=Subquery(latest.values("history_user__full_name")[:1]),
        )


class ItemCategoryViewSet(CatalogModelViewSet):
    queryset = ItemCategory.objects.all()
    serializer_class = ItemCategorySerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class ChecklistItemViewSet(CatalogModelViewSet):
    lookup_value_regex = "[^/]+"  # los códigos pueden tener puntos o espacios
    queryset = ChecklistItem.objects.select_related("category").all()
    serializer_class = ChecklistItemSerializer
    search_fields = ("identifier", "name")
    filterset_fields = ("category", "is_critical", "is_active")


class InspectionChecklistViewSet(CatalogModelViewSet):
    lookup_value_regex = "[^/]+"  # los códigos pueden tener puntos o espacios
    queryset = InspectionChecklist.objects.prefetch_related("equipment_types").order_by(
        "identifier"
    )
    serializer_class = InspectionChecklistSerializer
    filterset_fields = ("equipment_types", "is_active")

    @extend_schema(responses=ChecklistVersionSerializer(many=True))
    @action(detail=True, methods=("get",))
    def versions(self, request, pk=None):
        """Contenido de cada versión publicada de la lista."""
        checklist = self.get_object()
        return Response(ChecklistVersionSerializer(checklist.versions.all(), many=True).data)
