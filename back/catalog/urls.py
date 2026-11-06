from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ChecklistItemViewSet,
    EquipmentTypeViewSet,
    EquipmentViewSet,
    InspectionChecklistViewSet,
    ItemCategoryViewSet,
)

router = DefaultRouter()
router.register("equipment-types", EquipmentTypeViewSet, basename="equipment-type")
router.register("equipments", EquipmentViewSet, basename="equipment")
router.register("item-categories", ItemCategoryViewSet, basename="item-category")
router.register("items", ChecklistItemViewSet, basename="checklist-item")
router.register("checklists", InspectionChecklistViewSet, basename="checklist")

urlpatterns = [path("", include(router.urls))]
