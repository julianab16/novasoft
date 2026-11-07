from rest_framework import viewsets

from accounts.models import AccessLevel, Module, User
from accounts.permissions import HasModulePermission

from .models import Inspection
from .serializers import InspectionSerializer

# Roles que supervisan y por eso ven las inspecciones de todos.
SUPERVISOR_ROLES = (User.Role.ADMINISTRADOR, User.Role.JEFE_TALLER, User.Role.SST)


class InspectionViewSet(viewsets.ModelViewSet):
    queryset = Inspection.objects.select_related(
        "equipment", "checklist", "performed_by"
    ).prefetch_related("responses__item")
    serializer_class = InspectionSerializer
    permission_classes = (HasModulePermission,)
    module = Module.INSPECTIONS
    filterset_fields = ("equipment", "checklist", "status", "performed_by")
    ordering_fields = ("performed_at",)
    ordering = ("-performed_at",)

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        sees_all = (
            user.is_admin
            or user.role in SUPERVISOR_ROLES
            or user.access_level(Module.INSPECTIONS) == AccessLevel.VIEW
        )
        return queryset if sees_all else queryset.filter(performed_by=user)
