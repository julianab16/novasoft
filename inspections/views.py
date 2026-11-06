from rest_framework import viewsets

from .models import Inspection
from .serializers import InspectionSerializer


class InspectionViewSet(viewsets.ModelViewSet):
    queryset = Inspection.objects.select_related(
        "equipment", "checklist", "performed_by"
    ).prefetch_related("responses")
    serializer_class = InspectionSerializer
    filterset_fields = ("equipment", "checklist", "status", "performed_by")
    ordering_fields = ("performed_at",)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_superuser or self.request.user.role in ("administrador", "jefe_taller"):
            return queryset
        return queryset.filter(performed_by=self.request.user)
