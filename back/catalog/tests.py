from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccessLevel, Module, Role, User, permissions_with

from .models import (
    ChecklistItem,
    ChecklistVersion,
    Equipment,
    EquipmentType,
    InspectionChecklist,
    ItemCategory,
)


class CatalogApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            password="Admin-password-123",
            document="20000001",
            full_name="Admin User",
            role=User.Role.ADMINISTRADOR,
        )
        self.client.force_authenticate(self.admin)

    def test_catalogs_require_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/catalog/equipment-types/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inspection_view_role_can_read_but_not_write_catalogs(self):
        role = Role.objects.create(
            code="inspection_reader",
            name="Inspection Reader",
            permissions=permissions_with(view=(Module.INSPECTIONS,)),
        )
        user = User.objects.create_user(
            username="operator",
            password="Operator-password-123",
            document="20000002",
            full_name="Operator User",
            role=role.code,
        )
        self.client.force_authenticate(user)

        read_response = self.client.get("/api/catalog/equipment-types/")
        write_response = self.client.post(
            "/api/catalog/equipment-types/", {"name": "Truck"}
        )

        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(write_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_creating_equipment_type_trims_name(self):
        response = self.client.post(
            "/api/catalog/equipment-types/",
            {"name": "  Excavator  ", "description": " Heavy equipment "},
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(EquipmentType.objects.filter(name="Excavator").exists())

    def test_duplicate_equipment_type_name_is_rejected_case_insensitively(self):
        EquipmentType.objects.create(name="Excavator")

        response = self.client.post(
            "/api/catalog/equipment-types/", {"name": " excavator "}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_equipment_type_with_equipment_cannot_be_deleted(self):
        equipment_type = EquipmentType.objects.create(name="Truck")
        Equipment.objects.create(
            identifier="TRK-01",
            equipment_type=equipment_type,
            model="Model X",
        )

        response = self.client.delete(
            f"/api/catalog/equipment-types/{equipment_type.pk}/"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(EquipmentType.objects.filter(pk=equipment_type.pk).exists())

    def test_equipment_type_can_be_deactivated_and_deleted_when_unused(self):
        equipment_type = EquipmentType.objects.create(name="Unused")
        deactivate = self.client.post(
            f"/api/catalog/equipment-types/{equipment_type.pk}/deactivate/"
        )
        delete = self.client.delete(
            f"/api/catalog/equipment-types/{equipment_type.pk}/"
        )

        self.assertEqual(deactivate.status_code, status.HTTP_200_OK)
        self.assertFalse(deactivate.data["is_active"])
        self.assertEqual(delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(EquipmentType.objects.filter(pk=equipment_type.pk).exists())

    def test_equipment_identifier_is_normalized_and_immutable(self):
        equipment_type = EquipmentType.objects.create(name="Truck")
        create_response = self.client.post(
            "/api/catalog/equipments/",
            {
                "identifier": " trk-02 ",
                "equipment_type": equipment_type.pk,
                "model": "  Model Y  ",
                "year": 2024,
            },
        )
        update_response = self.client.patch(
            "/api/catalog/equipments/TRK-02/", {"identifier": "TRK-03"}
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["identifier"], "TRK-02")
        self.assertEqual(create_response.data["model"], "Model Y")
        self.assertEqual(update_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_equipment_rejects_duplicate_plate_and_inactive_type(self):
        equipment_type = EquipmentType.objects.create(name="Truck")
        Equipment.objects.create(
            identifier="TRK-03",
            plate="ABC-123",
            equipment_type=equipment_type,
            model="Model Z",
        )
        duplicate_plate = self.client.post(
            "/api/catalog/equipments/",
            {
                "identifier": "TRK-04",
                "plate": "abc-123",
                "equipment_type": equipment_type.pk,
                "model": "Model W",
            },
        )
        equipment_type.is_active = False
        equipment_type.save(update_fields=["is_active"])
        inactive_type = self.client.post(
            "/api/catalog/equipments/",
            {
                "identifier": "TRK-05",
                "equipment_type": equipment_type.pk,
                "model": "Model V",
            },
        )

        self.assertEqual(duplicate_plate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(inactive_type.status_code, status.HTTP_400_BAD_REQUEST)

    def test_equipment_updates_and_returns_history(self):
        equipment_type = EquipmentType.objects.create(name="Truck")
        equipment = Equipment.objects.create(
            identifier="TRK-06",
            equipment_type=equipment_type,
            model="Old Model",
        )

        response = self.client.patch(
            f"/api/catalog/equipments/{equipment.identifier}/",
            {"model": "New Model"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["model"], "New Model")
        self.assertIsNotNone(response.data["last_modified_at"])
        self.assertEqual(response.data["last_modified_by"], self.admin.full_name)

    def test_category_deletion_is_soft_and_items_can_be_created(self):
        category = ItemCategory.objects.create(name="Hydraulics")
        delete_response = self.client.delete(
            f"/api/catalog/item-categories/{category.pk}/"
        )
        item_response = self.client.post(
            "/api/catalog/items/",
            {
                "identifier": "HYD-01",
                "name": "Check hoses",
                "category": category.pk,
                "is_critical": True,
            },
        )

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        category.refresh_from_db()
        self.assertFalse(category.is_active)
        self.assertEqual(item_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ChecklistItem.objects.filter(identifier="HYD-01").exists())

    def test_checklist_creation_saves_version_snapshot_and_update_increments_version(self):
        equipment_type = EquipmentType.objects.create(name="Loader")
        payload = {
            "equipment_types": [equipment_type.pk],
            "sections": [
                {
                    "title": " Engine ",
                    "items": [{"text": "  Check oil level  ", "is_critical": True}],
                }
            ],
        }

        create_response = self.client.post(
            "/api/catalog/checklists/", payload, format="json"
        )
        checklist = InspectionChecklist.objects.get()
        update_response = self.client.patch(
            f"/api/catalog/checklists/{checklist.identifier}/",
            {"name": "Loader Daily Inspection"},
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(checklist.version, 1)
        snapshot = ChecklistVersion.objects.get(checklist=checklist, version=1)
        self.assertEqual(snapshot.sections[0]["items"][0]["text"], "Check oil level")
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        checklist.refresh_from_db()
        self.assertEqual(checklist.version, 2)
        self.assertTrue(
            ChecklistVersion.objects.filter(checklist=checklist, version=2).exists()
        )

    def test_equipment_type_cannot_have_two_checklists(self):
        equipment_type = EquipmentType.objects.create(name="Crane")
        InspectionChecklist.objects.create(
            identifier="CHK-CRANE-1", name="Crane checklist"
        ).equipment_types.add(equipment_type)

        response = self.client.post(
            "/api/catalog/checklists/",
            {
                "equipment_types": [equipment_type.pk],
                "sections": [
                    {"title": "Safety", "items": [{"text": "Check brakes"}]}
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_checklist_can_be_created_from_existing_items_and_list_versions(self):
        equipment_type = EquipmentType.objects.create(name="Bulldozer")
        category = ItemCategory.objects.create(name="Cab")
        item = ChecklistItem.objects.create(
            identifier="CAB-01", name="Check mirror", category=category
        )
        create_response = self.client.post(
            "/api/catalog/checklists/",
            {
                "identifier": " chk-bulldozer ",
                "name": "Bulldozer checks",
                "equipment_types": [equipment_type.pk],
                "item_orders": [{"item": item.identifier, "position": 1}],
            },
            format="json",
        )
        versions_response = self.client.get(
            "/api/catalog/checklists/CHK-BULLDOZER/versions/"
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["identifier"], "CHK-BULLDOZER")
        self.assertEqual(versions_response.status_code, status.HTTP_200_OK)
        self.assertEqual(versions_response.data[0]["version"], 1)

    def test_checklist_rejects_duplicate_item_order_and_empty_section_text(self):
        equipment_type = EquipmentType.objects.create(name="Grader")
        category = ItemCategory.objects.create(name="Controls")
        item = ChecklistItem.objects.create(
            identifier="CTL-01", name="Test controls", category=category
        )
        duplicate_orders = self.client.post(
            "/api/catalog/checklists/",
            {
                "equipment_types": [equipment_type.pk],
                "item_orders": [
                    {"item": item.identifier, "position": 1},
                    {"item": item.identifier, "position": 2},
                ],
            },
            format="json",
        )
        empty_text = self.client.post(
            "/api/catalog/checklists/",
            {
                "equipment_types": [equipment_type.pk],
                "sections": [{"title": "Controls", "items": [{"text": "  "}]}],
            },
            format="json",
        )

        self.assertEqual(duplicate_orders.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(empty_text.status_code, status.HTTP_400_BAD_REQUEST)

    def test_checklist_update_reuses_items_and_reactivates_category(self):
        equipment_type = EquipmentType.objects.create(name="Dozer")
        category = ItemCategory.objects.create(name="Engine", is_active=False)
        item = ChecklistItem.objects.create(
            identifier="ENG-01",
            name="Check oil",
            category=category,
            is_critical=True,
        )
        checklist = InspectionChecklist.objects.create(
            identifier="CHK-DOZER", name="Dozer checks"
        )
        checklist.equipment_types.add(equipment_type)
        checklist.items.add(item, through_defaults={"position": 1})

        response = self.client.patch(
            f"/api/catalog/checklists/{checklist.identifier}/",
            {
                "sections": [
                    {"title": "Engine", "items": [{"text": "Check oil", "is_critical": True}]}
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        category.refresh_from_db()
        checklist.refresh_from_db()
        self.assertTrue(category.is_active)
        self.assertEqual(checklist.version, 2)
        self.assertEqual(list(checklist.items.values_list("identifier", flat=True)), ["ENG-01"])
