import secrets
import string

from django.contrib.auth import password_validation
from django.contrib.auth.models import update_last_login
from django.db.models import Q
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AccessLevel, Module, Role, User, permissions_with


def generate_temporary_password(length=10):
    """Contraseña temporal legible: letras sin caracteres ambiguos y al menos un dígito."""
    letters = "".join(c for c in string.ascii_letters if c not in "lIO")
    digits = "23456789"
    chars = [secrets.choice(letters) for _ in range(length - 2)]
    chars += [secrets.choice(digits) for _ in range(2)]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


class SessionUserSerializer(serializers.ModelSerializer):
    """Datos del usuario autenticado que necesita el front al iniciar sesión."""

    role_name = serializers.CharField(read_only=True)
    is_admin = serializers.BooleanField(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "document",
            "role",
            "role_name",
            "is_admin",
            "must_change_password",
            "permissions",
        )

    def get_permissions(self, obj) -> dict[str, str]:
        return obj.permissions_map()


class LoginSerializer(serializers.Serializer):
    """Inicio de sesión con usuario o cédula. El mensaje de error no dice qué dato falló."""

    username = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False)

    default_error = "Credenciales inválidas."

    def validate(self, attrs):
        login = attrs["username"].strip()
        user = User.objects.filter(Q(username=login.lower()) | Q(document=login)).first()
        if not user or not user.check_password(attrs["password"]):
            raise serializers.ValidationError(self.default_error)
        if not user.is_active:
            raise serializers.ValidationError("Usuario no activo.")

        refresh = RefreshToken.for_user(user)
        update_last_login(None, user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": SessionUserSerializer(user).data,
        }


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False)
    new_password = serializers.CharField(trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("La contraseña actual no es correcta.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError(
                {"new_password": "La nueva contraseña debe ser distinta a la actual."}
            )
        try:
            password_validation.validate_password(attrs["new_password"], user)
        except Exception as exc:  # ValidationError de Django
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        return user


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=False, min_length=8, trim_whitespace=False
    )
    role_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "document",
            "role",
            "role_name",
            "is_active",
            "must_change_password",
            "password",
        )
        read_only_fields = ("id", "must_change_password")

    def validate_username(self, value):
        value = value.strip().lower()
        queryset = User.objects.filter(username=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Este usuario ya está en uso.")
        return value

    def validate_document(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Escribe el número de documento.")
        return value

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Escribe el nombre completo.")
        return value

    def validate_role(self, value):
        if not Role.objects.filter(code=value).exists():
            raise serializers.ValidationError("El rol seleccionado no existe.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        if (
            self.instance
            and request
            and self.instance.pk == request.user.pk
            and attrs.get("is_active") is False
        ):
            raise serializers.ValidationError(
                {"is_active": "No puedes desactivar tu propio usuario."}
            )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        temporary = password or generate_temporary_password()
        user = User(**validated_data, must_change_password=True)
        user.set_password(temporary)
        user.save()
        if not password:
            # Solo se devuelve en la respuesta de creación; nunca se vuelve a mostrar.
            user.temporary_password = temporary
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
            instance.must_change_password = True
        instance.save()
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if getattr(instance, "temporary_password", None):
            data["temporary_password"] = instance.temporary_password
        return data


class RoleSerializer(serializers.ModelSerializer):
    read_only = serializers.BooleanField(
        write_only=True,
        required=False,
        default=False,
        help_text="Al crear: empieza con 'Solo ver' en todos los módulos.",
    )
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ("id", "code", "name", "is_base", "permissions", "read_only", "user_count")
        read_only_fields = ("id", "code", "is_base", "permissions")

    def get_user_count(self, obj) -> int:
        return User.objects.filter(role=obj.code).count()

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Escribe el nombre del rol.")
        queryset = Role.objects.filter(name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ya existe un rol con este nombre.")
        return value

    def create(self, validated_data):
        read_only = validated_data.pop("read_only", False)
        base_code = (slugify(validated_data["name"]).replace("-", "_") or "rol")[:24]
        code, n = base_code, 2
        while Role.objects.filter(code=code).exists():
            code, n = f"{base_code}_{n}", n + 1
        permissions = permissions_with(view=Module.values) if read_only else permissions_with()
        return Role.objects.create(code=code, permissions=permissions, **validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("read_only", None)
        if instance.is_base and "name" in validated_data and validated_data["name"] != instance.name:
            raise serializers.ValidationError({"name": "No se puede renombrar un rol base."})
        return super().update(instance, validated_data)


class RolePermissionsSerializer(serializers.Serializer):
    """Recibe `{"inspections": "view", "users": "manage", ...}`; los módulos omitidos quedan sin acceso."""

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError("Envía un objeto {módulo: nivel}.")
        errors = {}
        for module, level in data.items():
            if module not in Module.values:
                errors[module] = "Módulo desconocido."
            elif level not in AccessLevel.values:
                errors[module] = f"Nivel inválido. Opciones: {', '.join(AccessLevel.values)}."
        if errors:
            raise serializers.ValidationError(errors)
        return {module: data.get(module, AccessLevel.NONE) for module in Module.values}
