from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .permissions import IsAdministrator
from rest_framework.permissions import IsAuthenticated
from .serializers import LoginSerializer, UserSerializer


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("full_name")
    serializer_class = UserSerializer
    permission_classes = (IsAdministrator,)
    search_fields = ("username", "full_name", "document")
    filterset_fields = ("role", "is_active")
    ordering_fields = ("full_name", "username")

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(request=None, responses={204: None})
class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)
