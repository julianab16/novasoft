from django.db import transaction
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Module, Role, User
from .permissions import HasModulePermission
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    LogoutSerializer,
    RolePermissionsSerializer,
    RoleSerializer,
    SessionUserSerializer,
    UserSerializer,
    generate_temporary_password,
)


class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = (AllowAny,)
    authentication_classes = ()

    @extend_schema(
        responses=inline_serializer(
            "LoginResponse",
            {
                "refresh": serializers.CharField(),
                "access": serializers.CharField(),
                "user": SessionUserSerializer(),
            },
        )
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("full_name")
    serializer_class = UserSerializer
    permission_classes = (HasModulePermission,)
    module = Module.USERS
    search_fields = ("username", "full_name", "document")
    filterset_fields = ("role", "is_active")
    ordering_fields = ("full_name", "username")

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            raise ValidationError({"is_active": "No puedes desactivar tu propio usuario."})
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        request=None,
        responses=inline_serializer(
            "ResetPasswordResponse", {"temporary_password": serializers.CharField()}
        ),
    )
    @action(detail=True, methods=("post",), url_path="reset-password")
    def reset_password(self, request, pk=None):
        """Genera una contraseña temporal; el usuario deberá cambiarla al ingresar."""
        user = self.get_object()
        temporary = generate_temporary_password()
        user.set_password(temporary)
        user.must_change_password = True
        user.save(update_fields=["password", "must_change_password"])
        return Response({"temporary_password": temporary})


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = (HasModulePermission,)
    module = Module.USERS
    http_method_names = ("get", "post", "patch", "put", "delete", "head", "options")

    def perform_destroy(self, instance):
        if instance.is_base:
            raise ValidationError({"detail": "No se puede eliminar un rol base."})
        if User.objects.filter(role=instance.code).exists():
            raise ValidationError(
                {"detail": "No se puede eliminar un rol que tiene usuarios asignados."}
            )
        instance.delete()

    @extend_schema(request=RolePermissionsSerializer, responses=RoleSerializer)
    @action(detail=True, methods=("put",))
    def permissions(self, request, pk=None):
        """Reemplaza los permisos del rol: `{"inspections": "view", ...}`."""
        role = self.get_object()
        if role.code == User.Role.ADMINISTRADOR:
            raise ValidationError(
                {"detail": "El Administrador siempre tiene acceso total; sus permisos no se modifican."}
            )
        serializer = RolePermissionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role.permissions = serializer.validated_data
        role.save(update_fields=["permissions"])
        return Response(RoleSerializer(role).data)


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=SessionUserSerializer)
    def get(self, request):
        return Response(SessionUserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=ChangePasswordSerializer, responses={204: None})
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=LogoutSerializer, responses={204: None})
    @transaction.atomic
    def post(self, request):
        """Invalida el refresh token si se envía, para que no pueda renovar más sesiones."""
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        refresh = serializer.validated_data.get("refresh")
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except TokenError:
                pass  # Ya vencido o inválido: no hay nada que invalidar.
        return Response(status=status.HTTP_204_NO_CONTENT)
