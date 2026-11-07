import uuid
from datetime import date

from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from .models import (
    ChecklistItem,
    ChecklistItemOrder,
    ChecklistVersion,
    Equipment,
    EquipmentType,
    InspectionChecklist,
    ItemCategory,
)


class EquipmentTypeSerializer(serializers.ModelSerializer):
    equipment_count = serializers.SerializerMethodField()

    class Meta:
        model = EquipmentType
        fields = ("id", "name", "description", "is_active", "equipment_count")
        read_only_fields = ("id",)

    def get_equipment_count(self, obj) -> int:
        count = getattr(obj, "equipment_count", None)
        return obj.equipments.count() if count is None else count

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Escribe el nombre del tipo.")
        queryset = EquipmentType.objects.filter(name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ya existe un tipo con este nombre.")
        return value


class EquipmentSerializer(serializers.ModelSerializer):
    equipment_type_name = serializers.CharField(source="equipment_type.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    last_modified_by = serializers.SerializerMethodField()
    last_modified_at = serializers.SerializerMethodField()

    class Meta:
        model = Equipment
        fields = (
            "identifier",
            "plate",
            "equipment_type",
            "equipment_type_name",
            "status",
            "status_display",
            "model",
            "serial_number",
            "year",
            "hour_meter",
            "last_modified_by",
            "last_modified_at",
        )
        # La unicidad del código se valida en validate_identifier (sin distinguir mayúsculas).
        extra_kwargs = {"identifier": {"validators": []}}

    def _last_history(self, obj):
        if not hasattr(obj, "_last_history"):
            obj._last_history = (
                obj.history.select_related("history_user").order_by("-history_date").first()
            )
        return obj._last_history

    def get_last_modified_by(self, obj) -> str | None:
        if hasattr(obj, "last_modified_by_name"):  # anotado en el queryset de la vista
            return obj.last_modified_by_name
        record = self._last_history(obj)
        user = record.history_user if record else None
        return (user.full_name or user.username) if user else None

    def get_last_modified_at(self, obj) -> str | None:
        if hasattr(obj, "last_modified_on"):
            value = obj.last_modified_on
        else:
            record = self._last_history(obj)
            value = record.history_date if record else None
        return serializers.DateTimeField().to_representation(value) if value else None

    def validate_identifier(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("Escribe el código o la placa.")
        if self.instance:
            if value != self.instance.identifier:
                raise serializers.ValidationError("El código de un equipo no se puede cambiar.")
            return value
        if Equipment.objects.filter(identifier__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un equipo con este código o placa.")
        return value

    def validate_plate(self, value):
        value = value.strip().upper()
        if value:
            queryset = Equipment.objects.filter(plate__iexact=value)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError("Ya existe un equipo con esta placa.")
        return value

    def validate_model(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Escribe la marca o el modelo.")
        return value

    def validate_year(self, value):
        if value is not None and not 1950 <= value <= date.today().year + 1:
            raise serializers.ValidationError("Escribe un año válido.")
        return value

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        # Las anotaciones del queryset se calcularon antes de guardar: se descartan
        # para que la respuesta muestre la modificación que se acaba de hacer.
        for attr in ("last_modified_on", "last_modified_by_name", "_last_history"):
            instance.__dict__.pop(attr, None)
        return instance

    def validate_equipment_type(self, value):
        changing = not self.instance or self.instance.equipment_type_id != value.pk
        if changing and not value.is_active:
            raise serializers.ValidationError("El tipo de equipo está inactivo.")
        return value


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


class SectionItemSerializer(serializers.Serializer):
    identifier = serializers.CharField(read_only=True)
    text = serializers.CharField(max_length=200)
    is_critical = serializers.BooleanField(default=False)


class SectionSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=100)
    items = SectionItemSerializer(many=True, allow_empty=False)


class ChecklistVersionSerializer(serializers.ModelSerializer):
    created_by = serializers.SlugRelatedField(slug_field="username", read_only=True)

    class Meta:
        model = ChecklistVersion
        fields = ("version", "name", "sections", "created_at", "created_by")


class InspectionChecklistSerializer(serializers.ModelSerializer):
    """Lista de inspección versionada.

    El contenido se puede enviar de dos formas:
    - `sections`: `[{"title": "Motor", "items": [{"text": "Nivel de aceite", "is_critical": true}]}]`.
      Cada título es una categoría y cada texto un ítem; se crean si no existen.
    - `item_orders`: `[{"item": "ITEM-001", "position": 1}]` con ítems ya creados.
    """

    identifier = serializers.CharField(max_length=50, required=False)
    name = serializers.CharField(max_length=150, required=False)
    item_orders = ChecklistItemOrderSerializer(
        source="checklistitemorder_set", many=True, required=False
    )
    sections = SectionSerializer(many=True, required=False)
    equipment_types_detail = serializers.SerializerMethodField()

    class Meta:
        model = InspectionChecklist
        fields = (
            "identifier",
            "name",
            "equipment_types",
            "equipment_types_detail",
            "item_orders",
            "sections",
            "version",
            "is_active",
        )
        read_only_fields = ("version",)

    def get_equipment_types_detail(self, obj) -> list[dict]:
        return [{"id": t.id, "name": t.name} for t in obj.equipment_types.all()]

    def validate_identifier(self, value):
        value = value.strip().upper()
        if self.instance:
            if value != self.instance.identifier:
                raise serializers.ValidationError("El identificador de la lista no se puede cambiar.")
        elif InspectionChecklist.objects.filter(identifier=value).exists():
            raise serializers.ValidationError("Ya existe una lista con este identificador.")
        return value

    def validate_equipment_types(self, value):
        if not value:
            raise serializers.ValidationError("Elige al menos un tipo de equipo.")
        taken = InspectionChecklist.objects.filter(equipment_types__in=value)
        if self.instance:
            taken = taken.exclude(pk=self.instance.pk)
        for checklist in taken.distinct():
            name = checklist.equipment_types.filter(pk__in=[t.pk for t in value]).first()
            raise serializers.ValidationError(f"El tipo {name} ya tiene lista de inspección.")
        return value

    def validate(self, attrs):
        if "sections" in attrs and "checklistitemorder_set" in attrs:
            raise serializers.ValidationError("Envía `sections` o `item_orders`, no ambos.")
        if not self.instance and "equipment_types" not in attrs:
            raise serializers.ValidationError({"equipment_types": "Elige al menos un tipo de equipo."})
        orders = attrs.get("checklistitemorder_set")
        if orders is not None:
            items = [o["item"].pk for o in orders]
            positions = [o["position"] for o in orders]
            if len(set(items)) != len(items):
                raise serializers.ValidationError({"item_orders": "Un ítem está repetido."})
            if len(set(positions)) != len(positions):
                raise serializers.ValidationError({"item_orders": "Una posición está repetida."})
        for section in attrs.get("sections", []):
            section["title"] = section["title"].strip()
            for item in section["items"]:
                item["text"] = item["text"].strip()
                # En PATCH (parcial) DRF no aplica los `default` de los campos anidados.
                item.setdefault("is_critical", False)
            if not section["title"] or not all(i["text"] for i in section["items"]):
                raise serializers.ValidationError(
                    {"sections": "Cada sección necesita un título y sus ítems un texto."}
                )
        return attrs

    # --- escritura ---

    def _new_identifier(self, types):
        base = "CHK-" + (slugify(types[0].name).upper()[:30] if types else uuid.uuid4().hex[:6].upper())
        identifier, n = base, 2
        while InspectionChecklist.objects.filter(identifier=identifier).exists():
            identifier, n = f"{base}-{n}", n + 1
        return identifier

    def _apply_sections(self, checklist, sections):
        """Convierte secciones en ítems ordenados.

        Los ítems no se editan en sitio: si el texto cambia se crea uno nuevo, así
        las respuestas de inspecciones anteriores siguen apuntando al texto original.
        """
        used, orders, position = set(), [], 1
        current = set(checklist.items.values_list("pk", flat=True))
        for section in sections:
            category = ItemCategory.objects.filter(name__iexact=section["title"]).first()
            if not category:
                category = ItemCategory.objects.create(name=section["title"])
            elif not category.is_active:
                category.is_active = True
                category.save(update_fields=["is_active"])
            for entry in section["items"]:
                candidates = ChecklistItem.objects.filter(
                    category=category,
                    name=entry["text"],
                    is_critical=entry["is_critical"],
                    is_active=True,
                ).exclude(pk__in=used)
                item = candidates.filter(pk__in=current).first() or candidates.first()
                if not item:
                    item = ChecklistItem.objects.create(
                        identifier=f"ITM-{uuid.uuid4().hex[:10].upper()}",
                        name=entry["text"],
                        category=category,
                        is_critical=entry["is_critical"],
                    )
                used.add(item.pk)
                orders.append(ChecklistItemOrder(checklist=checklist, item=item, position=position))
                position += 1
        self._replace_orders(checklist, orders)

    def _replace_orders(self, checklist, orders):
        checklist.checklistitemorder_set.all().delete()
        ChecklistItemOrder.objects.bulk_create(orders)

    def _save_content(self, checklist, sections, orders):
        if sections is not None:
            self._apply_sections(checklist, sections)
        elif orders is not None:
            self._replace_orders(
                checklist, [ChecklistItemOrder(checklist=checklist, **o) for o in orders]
            )

    def _snapshot(self, checklist):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        ChecklistVersion.objects.update_or_create(
            checklist=checklist,
            version=checklist.version,
            defaults={"name": checklist.name, "sections": checklist.sections(), "created_by": user},
        )

    @transaction.atomic
    def create(self, validated_data):
        sections = validated_data.pop("sections", None)
        orders = validated_data.pop("checklistitemorder_set", None)
        types = validated_data.pop("equipment_types")
        validated_data.setdefault("identifier", self._new_identifier(types))
        validated_data.setdefault("name", f"Lista de {types[0].name.lower()}")
        checklist = InspectionChecklist.objects.create(**validated_data)
        checklist.equipment_types.set(types)
        self._save_content(checklist, sections, orders)
        self._snapshot(checklist)
        return checklist

    @transaction.atomic
    def update(self, instance, validated_data):
        sections = validated_data.pop("sections", None)
        orders = validated_data.pop("checklistitemorder_set", None)
        types = validated_data.pop("equipment_types", None)
        validated_data.pop("identifier", None)
        content_changed = (
            sections is not None
            or orders is not None
            or validated_data.get("name", instance.name) != instance.name
        )
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if content_changed:
            # Nueva versión: las inspecciones anteriores conservan la versión que respondieron.
            instance.version += 1
        instance.save()
        if types is not None:
            instance.equipment_types.set(types)
        self._save_content(instance, sections, orders)
        if content_changed:
            self._snapshot(instance)
        return instance
