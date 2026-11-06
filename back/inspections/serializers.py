from django.db import transaction
from rest_framework import serializers

from catalog.models import ChecklistItem

from .models import Inspection, InspectionResponse


class InspectionResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionResponse
        fields = ("item", "result", "notes")


class InspectionSerializer(serializers.ModelSerializer):
    responses = InspectionResponseSerializer(many=True)
    performed_by = serializers.PrimaryKeyRelatedField(read_only=True)
    checklist_version = serializers.IntegerField(read_only=True)

    class Meta:
        model = Inspection
        fields = (
            "id",
            "equipment",
            "checklist",
            "checklist_version",
            "performed_by",
            "performed_at",
            "status",
            "responses",
        )
        read_only_fields = ("id", "performed_at")

    def validate(self, attrs):
        checklist = attrs["checklist"]
        equipment = attrs["equipment"]
        if not checklist.equipment_types.filter(pk=equipment.equipment_type_id).exists():
            raise serializers.ValidationError(
                {"checklist": "La lista no está asociada al tipo de equipo seleccionado."}
            )
        response_items = {response["item"].pk for response in attrs.get("responses", [])}
        checklist_items = set(checklist.items.values_list("pk", flat=True))
        if response_items != checklist_items:
            raise serializers.ValidationError(
                {"responses": "Debe responder todos los ítems de la versión de la lista."}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        responses = validated_data.pop("responses")
        checklist = validated_data["checklist"]
        inspection = Inspection.objects.create(
            performed_by=self.context["request"].user,
            checklist_version=checklist.version,
            **validated_data,
        )
        InspectionResponse.objects.bulk_create(
            [InspectionResponse(inspection=inspection, **response) for response in responses]
        )
        return inspection
