from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from catalog.models import Equipment, EquipmentType, InspectionChecklist


class LoadInitialDataCommandTests(TestCase):
    def test_command_loads_fixture_and_is_idempotent(self):
        first_output = StringIO()
        second_output = StringIO()

        call_command("cargar_datos_iniciales", stdout=first_output)
        first_counts = (
            EquipmentType.objects.count(),
            Equipment.objects.count(),
            InspectionChecklist.objects.count(),
        )
        call_command("cargar_datos_iniciales", stdout=second_output)
        second_counts = (
            EquipmentType.objects.count(),
            Equipment.objects.count(),
            InspectionChecklist.objects.count(),
        )

        self.assertEqual(first_counts, (3, 21, 3))
        self.assertEqual(second_counts, first_counts)
        self.assertIn("Creados: 3 tipos, 21 equipos, 3 listas.", first_output.getvalue())
        self.assertIn("Creados: 0 tipos, 0 equipos, 0 listas.", second_output.getvalue())
