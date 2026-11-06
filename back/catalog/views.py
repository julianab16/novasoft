from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.permissions import IsAdministrator

from .models import (
    ChecklistItem,
    Equipment,
    EquipmentType,
    InspectionChecklist,
    ItemCategory,
)
from .serializers import (
    ChecklistItemSerializer,
    EquipmentSerializer,
    EquipmentTypeSerializer,
    InspectionChecklistSerializer,
    ItemCategorySerializer,
)


class AdminModelViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAdministrator,)


class EquipmentTypeViewSet(AdminModelViewSet):
    queryset = EquipmentType.objects.all()
    serializer_class = EquipmentTypeSerializer
    search_fields = ("name",)
    filterset_fields = ("is_active",)

    @action(detail=True, methods=("post",))
    def deactivate(self, request, pk=None):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

    def perform_destroy(self, instance):
        if instance.equipments.exists():
            raise ValidationError(
                {"detail": "No se puede eliminar un tipo de equipo con equipos asociados."}
            )
        instance.delete()


class EquipmentViewSet(AdminModelViewSet):
    queryset = Equipment.objects.select_related("equipment_type").all()
    serializer_class = EquipmentSerializer
    search_fields = ("identifier", "plate", "model")
    filterset_fields = ("equipment_type", "status")


class ItemCategoryViewSet(AdminModelViewSet):
    queryset = ItemCategory.objects.all()
    serializer_class = ItemCategorySerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class ChecklistItemViewSet(AdminModelViewSet):
    queryset = ChecklistItem.objects.select_related("category").all()
    serializer_class = ChecklistItemSerializer
    search_fields = ("identifier", "name")
    filterset_fields = ("category", "is_critical", "is_active")


class InspectionChecklistViewSet(AdminModelViewSet):
    queryset = InspectionChecklist.objects.prefetch_related("equipment_types", "items").all()
    serializer_class = InspectionChecklistSerializer
    filterset_fields = ("equipment_types", "is_active")

