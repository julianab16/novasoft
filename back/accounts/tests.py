from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccessLevel, Module, Role, User


class AccountApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            password="Admin-password-123",
            document="10000001",
            full_name="Admin User",
            role=User.Role.ADMINISTRADOR,
        )
        self.client.force_authenticate(self.admin)

    def test_login_accepts_username_and_returns_permissions(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            "/api/auth/login/",
            {"username": " ADMIN ", "password": "Admin-password-123"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["role"], User.Role.ADMINISTRADOR)
        self.assertEqual(
            response.data["user"]["permissions"][Module.USERS], AccessLevel.MANAGE
        )

    def test_login_rejects_invalid_password(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            "/api/auth/login/", {"username": "admin", "password": "wrong"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_accepts_document_and_rejects_inactive_user(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/auth/login/",
            {"username": self.admin.document, "password": "Admin-password-123"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.admin.is_active = False
        self.admin.save(update_fields=["is_active"])
        response = self.client.post(
            "/api/auth/login/",
            {"username": self.admin.document, "password": "Admin-password-123"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_creating_user_generates_temporary_password(self):
        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": " New.User ",
                "full_name": " New User ",
                "document": " 10000002 ",
                "role": User.Role.OPERARIO,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(document="10000002")
        self.assertEqual(user.username, "new.user")
        self.assertEqual(user.full_name, "New User")
        self.assertTrue(user.must_change_password)
        self.assertTrue(user.check_password(response.data["temporary_password"]))
        self.assertNotIn("password", response.data)

    def test_cannot_create_user_with_duplicate_document(self):
        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "another",
                "full_name": "Another User",
                "document": self.admin.document,
                "role": User.Role.OPERARIO,
                "password": "Another-password-123",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_can_be_created_with_explicit_password(self):
        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "operator",
                "full_name": "Operator User",
                "document": "10000006",
                "role": User.Role.OPERARIO,
                "password": "Operator-password-123",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(document="10000006")
        self.assertTrue(user.check_password("Operator-password-123"))
        self.assertNotIn("temporary_password", response.data)
        self.assertTrue(user.must_change_password)

    def test_user_creation_rejects_unknown_role_and_short_password(self):
        payload = {
            "username": "operator",
            "full_name": "Operator User",
            "document": "10000007",
            "role": "unknown",
            "password": "short",
        }

        response = self.client.post("/api/accounts/users/", payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="operator").exists())

    def test_user_can_change_password_and_clear_temporary_password_flag(self):
        user = User.objects.create_user(
            username="operator",
            password="Temporary-password-123",
            document="10000003",
            full_name="Operator User",
            role=User.Role.OPERARIO,
            must_change_password=True,
        )
        self.client.force_authenticate(user)

        response = self.client.post(
            "/api/accounts/me/change-password/",
            {
                "current_password": "Temporary-password-123",
                "new_password": "New-secure-password-456",
            },
        )

        user.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(user.check_password("New-secure-password-456"))
        self.assertFalse(user.must_change_password)

    def test_user_cannot_deactivate_self(self):
        response = self.client.delete(f"/api/accounts/users/{self.admin.pk}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_user_can_view_session_and_reset_another_users_password(self):
        user = User.objects.create_user(
            username="operator",
            password="Operator-password-123",
            document="10000008",
            full_name="Operator User",
            role=User.Role.OPERARIO,
        )

        me_response = self.client.get("/api/accounts/me/")
        reset_response = self.client.post(
            f"/api/accounts/users/{user.pk}/reset-password/"
        )

        user.refresh_from_db()
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["id"], self.admin.pk)
        self.assertEqual(reset_response.status_code, status.HTTP_200_OK)
        self.assertTrue(user.must_change_password)
        self.assertTrue(user.check_password(reset_response.data["temporary_password"]))

    def test_logout_without_refresh_succeeds(self):
        response = self.client.post("/api/accounts/logout/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_logout_blacklists_provided_refresh_token(self):
        self.client.force_authenticate(user=None)
        login = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "Admin-password-123"},
        )

        logout = self.client.post(
            "/api/accounts/logout/",
            {"refresh": login.data["refresh"]},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {login.data['access']}",
        )
        refresh = self.client.post(
            "/api/auth/refresh/", {"refresh": login.data["refresh"]}, format="json"
        )

        self.assertEqual(logout.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_change_rejects_wrong_current_and_weak_new_passwords(self):
        wrong_current = self.client.post(
            "/api/accounts/me/change-password/",
            {
                "current_password": "not-the-password",
                "new_password": "New-secure-password-456",
            },
        )
        weak_password = self.client.post(
            "/api/accounts/me/change-password/",
            {
                "current_password": "Admin-password-123",
                "new_password": "admin",
            },
        )

        self.assertEqual(wrong_current.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(weak_password.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deleting_another_user_deactivates_instead_of_removing(self):
        user = User.objects.create_user(
            username="operator",
            password="Operator-password-123",
            document="10000004",
            full_name="Operator User",
            role=User.Role.OPERARIO,
        )

        response = self.client.delete(f"/api/accounts/users/{user.pk}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_read_only_role_gets_view_access_to_every_module(self):
        response = self.client.post(
            "/api/accounts/roles/", {"name": "Auditor", "read_only": True}
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        role = Role.objects.get(code="auditor")
        self.assertTrue(all(level == AccessLevel.VIEW for level in role.permissions.values()))

    def test_role_permissions_reject_unknown_modules(self):
        role = Role.objects.create(
            code="custom", name="Custom", permissions={Module.USERS: AccessLevel.VIEW}
        )

        response = self.client.put(
            f"/api/accounts/roles/{role.pk}/permissions/",
            {"unknown": AccessLevel.MANAGE},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_role_permissions_can_be_updated_and_base_role_cannot_be_deleted(self):
        role = Role.objects.create(
            code="custom", name="Custom", permissions={}
        )
        update = self.client.put(
            f"/api/accounts/roles/{role.pk}/permissions/",
            {Module.INSPECTIONS: AccessLevel.VIEW},
            format="json",
        )
        base_role = Role.objects.get(code=User.Role.ADMINISTRADOR)
        delete = self.client.delete(f"/api/accounts/roles/{base_role.pk}/")

        self.assertEqual(update.status_code, status.HTTP_200_OK)
        role.refresh_from_db()
        self.assertEqual(role.permissions[Module.INSPECTIONS], AccessLevel.VIEW)
        self.assertEqual(delete.status_code, status.HTTP_400_BAD_REQUEST)

    def test_roles_with_assigned_users_cannot_be_deleted(self):
        role = Role.objects.create(code="custom", name="Custom", permissions={})
        User.objects.create_user(
            username="custom-user",
            password="Custom-password-123",
            document="10000009",
            full_name="Custom User",
            role=role.code,
        )

        response = self.client.delete(f"/api/accounts/roles/{role.pk}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_role_code_is_made_unique_when_names_slugify_to_same_value(self):
        Role.objects.create(code="field_team", name="Existing Team", permissions={})

        response = self.client.post(
            "/api/accounts/roles/", {"name": "Field Team"}
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["code"], "field_team_2")
