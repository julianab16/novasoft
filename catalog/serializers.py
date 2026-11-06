from rest_framework import serializers

from .models import (
    ChecklistItem,
    ChecklistItemOrder,
    Equipment,
    EquipmentType,
    InspectionChecklist,
    ItemCategory,
)


class EquipmentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentType
        fields = ("id", "name", "is_active")
        read_only_fields = ("id",)


class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = ("identifier", "plate", "equipment_type", "status", "model")


class ItemCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCategory
        fields = ("id", "name", "is_active")
        read_only_fields = ("id",)


class ChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItem
        fields = ("identifier", "name", "category", "is_critical", "is_active")


class ChecklistItemOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItemOrder
        fields = ("item", "position")


class InspectionChecklistSerializer(serializers.ModelSerializer):
    item_orders = ChecklistItemOrderSerializer(source="checklistitemorder_set", many=True)

    class Meta:
        model = InspectionChecklist
        fields = ("identifier", "name", "equipment_types", "item_orders", "version", "is_active")
        read_only_fields = ("version",)

    def create(self, validated_data):
        orders = validated_data.pop("checklistitemorder_set", [])
        checklist = InspectionChecklist.objects.create(**validated_data)
        for order in orders:
            ChecklistItemOrder.objects.create(checklist=checklist, **order)
        return checklist

    def update(self, instance, validated_data):
        orders = validated_data.pop("checklistitemorder_set", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.version += 1
        instance.save()
        if orders is not None:
            instance.checklistitemorder_set.all().delete()
            for order in orders:
                ChecklistItemOrder.objects.create(checklist=instance, **order)
        return instance
