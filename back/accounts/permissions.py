from rest_framework.permissions import BasePermission

from .models import User


class IsAdministrator(BasePermission):
    message = "Acceso denegado."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser or request.user.role == User.Role.ADMINISTRADOR)
        )


class HasRolePermission(BasePermission):
    message = "Acceso denegado."

    def has_permission(self, request, view):
        allowed_roles = getattr(view, "allowed_roles", ())
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser or request.user.role in allowed_roles)
        )
