from rest_framework.routers import DefaultRouter
from django.urls import include, path

from .views import LogoutView, UserViewSet

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("", include(router.urls)),
    path("logout/", LogoutView.as_view(), name="logout"),
]
