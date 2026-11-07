from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from catalog.models import (
    ChecklistItem,
    ChecklistItemOrder,
    Equipment,
    EquipmentType,
    InspectionChecklist,
    ItemCategory,
)
from .models import Inspection, InspectionResponse


class InspectionApiTests(APITestCase):
    def setUp(self):
        self.operator = User.objects.create_user(
            username="operator",
            password="Operator-password-123",
            document="30000001",
            full_name="Operator User",
            role=User.Role.OPERARIO,
        )
        self.client.force_authenticate(self.operator)
        self.equipment_type = EquipmentType.objects.create(name="Forklift")
        self.equipment = Equipment.objects.create(
            identifier="FL-01",
            equipment_type=self.equipment_type,
            model="Forklift Model",
        )
        self.category = ItemCategory.objects.create(name="Safety")
        self.item = ChecklistItem.objects.create(
            identifier="ITEM-01",
            name="Check seat belt",
            category=self.category,
        )
        self.checklist = InspectionChecklist.objects.create(
            identifier="CHK-FORKLIFT",
            name="Forklift checklist",
        )
        self.checklist.equipment_types.add(self.equipment_type)
        ChecklistItemOrder.objects.create(
            checklist=self.checklist, item=self.item, position=1
        )

    def test_operator_can_create_inspection_with_all_checklist_responses(self):
        response = self.client.post(
            "/api/inspections/records/",
            {
                "equipment": self.equipment.identifier,
                "checklist": self.checklist.identifier,
                "responses": [
                    {
                        "item": self.item.identifier,
                        "result": "complies",
                        "notes": "Ready",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["performed_by"], self.operator.pk)
        self.assertEqual(response.data["checklist_version"], self.checklist.version)
        self.assertEqual(len(response.data["responses"]), 1)

    def test_inspection_requires_response_for_every_checklist_item(self):
        response = self.client.post(
            "/api/inspections/records/",
            {
                "equipment": self.equipment.identifier,
                "checklist": self.checklist.identifier,
                "responses": [],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_completed_inspection_can_change_status_but_not_answers(self):
        create_response = self.client.post(
            "/api/inspections/records/",
            {
                "equipment": self.equipment.identifier,
                "checklist": self.checklist.identifier,
                "responses": [
                    {"item": self.item.identifier, "result": "complies"}
                ],
            },
            format="json",
        )
        inspection_id = create_response.data["id"]
        update_response = self.client.patch(
            f"/api/inspections/records/{inspection_id}/",
            {"status": "completed"},
            format="json",
        )
        invalid_update = self.client.patch(
            f"/api/inspections/records/{inspection_id}/",
            {"responses": []},
            format="json",
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["status"], "completed")
        self.assertEqual(invalid_update.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inspection_rejects_checklist_for_a_different_equipment_type(self):
        other_type = EquipmentType.objects.create(name="Roller")
        other_equipment = Equipment.objects.create(
            identifier="RL-01",
            equipment_type=other_type,
            model="Roller Model",
        )

        response = self.client.post(
            "/api/inspections/records/",
            {
                "equipment": other_equipment.identifier,
                "checklist": self.checklist.identifier,
                "responses": [
                    {"item": self.item.identifier, "result": "complies"}
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_operator_can_only_list_own_inspections(self):
        other_operator = User.objects.create_user(
            username="other",
            password="Other-password-123",
            document="30000002",
            full_name="Other Operator",
            role=User.Role.OPERARIO,
        )
        inspection = Inspection.objects.create(
            equipment=self.equipment,
            checklist=self.checklist,
            checklist_version=self.checklist.version,
            performed_by=other_operator,
        )
        InspectionResponse.objects.create(
            inspection=inspection,
            item=self.item,
            result="complies",
        )

        response = self.client.get("/api/inspections/records/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
