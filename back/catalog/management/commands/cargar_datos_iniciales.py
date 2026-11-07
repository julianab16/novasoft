"""Carga los tipos, equipos y listas de inspección del cliente.

Los datos salen del Excel "CONTROL PREOPERACIONAL EQUIPOS MÓVILES - TCHO"
(los mismos que usa el modo de prueba del front). Es seguro ejecutarlo varias
veces: lo que ya existe no se toca.

    python manage.py cargar_datos_iniciales
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Equipment, EquipmentType
from catalog.serializers import InspectionChecklistSerializer

DATA_FILE = Path(__file__).resolve().parents[2] / "fixtures" / "datos_iniciales.json"


class Command(BaseCommand):
    help = "Carga los tipos de equipo, equipos y listas de inspección iniciales del cliente."

    @transaction.atomic
    def handle(self, *args, **options):
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        created = {"tipos": 0, "equipos": 0, "listas": 0}

        types = {}
        for entry in data["equipment_types"]:
            types[entry["name"]], new = EquipmentType.objects.get_or_create(
                name=entry["name"], defaults={"description": entry["description"]}
            )
            created["tipos"] += new

        for entry in data["equipments"]:
            _, new = Equipment.objects.get_or_create(
                identifier=entry["identifier"],
                defaults={**entry, "equipment_type": types[entry["equipment_type"]]},
            )
            created["equipos"] += new

        for entry in data["checklists"]:
            equipment_type = types[entry["equipment_type"]]
            if equipment_type.checklists.exists():
                continue
            serializer = InspectionChecklistSerializer(
                data={"equipment_types": [equipment_type.pk], "sections": entry["sections"]}
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            created["listas"] += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Creados: {tipos} tipos, {equipos} equipos, {listas} listas.".format(**created)
            )
        )
