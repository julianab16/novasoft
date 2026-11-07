from django.db import transaction
from rest_framework import serializers

from .models import Inspection, InspectionResponse


class InspectionResponseSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = InspectionResponse
        fields = ("item", "item_name", "result", "notes")


class InspectionSerializer(serializers.ModelSerializer):
    responses = InspectionResponseSerializer(many=True)
    performed_by = serializers.PrimaryKeyRelatedField(read_only=True)
    performed_by_name = serializers.CharField(source="performed_by.full_name", read_only=True)
    checklist_version = serializers.IntegerField(read_only=True)

    class Meta:
        model = Inspection
        fields = (
            "id",
            "equipment",
            "checklist",
            "checklist_version",
            "performed_by",
            "performed_by_name",
            "performed_at",
            "status",
            "responses",
        )
        read_only_fields = ("id", "performed_at")

    def validate(self, attrs):
        if self.instance:
            # Una inspección registrada solo cambia de estado; equipo, lista y respuestas son fijos.
            fixed = {"equipment", "checklist", "responses"} & set(attrs)
            if fixed:
                raise serializers.ValidationError(
                    {field: "No se puede modificar en una inspección registrada." for field in fixed}
                )
            return attrs

        checklist = attrs["checklist"]
        equipment = attrs["equipment"]
        if not checklist.is_active:
            raise serializers.ValidationError({"checklist": "La lista de inspección está inactiva."})
        if not checklist.equipment_types.filter(pk=equipment.equipment_type_id).exists():
            raise serializers.ValidationError(
                {"checklist": "La lista no está asociada al tipo de equipo seleccionado."}
            )
        response_items = [response["item"].pk for response in attrs.get("responses", [])]
        checklist_items = set(checklist.items.values_list("pk", flat=True))
        if len(response_items) != len(set(response_items)) or set(response_items) != checklist_items:
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

    def update(self, instance, validated_data):
        instance.status = validated_data.get("status", instance.status)
        instance.save(update_fields=["status"])
        return instance
