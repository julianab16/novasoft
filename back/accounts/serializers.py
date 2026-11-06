from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class LoginSerializer(TokenObtainPairSerializer):
    username_field = "username"

    def validate(self, attrs):
        username = (attrs.get("username") or "").strip().lower()
        user_record = User.objects.filter(username=username).first()
        if user_record and not user_record.is_active:
            raise serializers.ValidationError("Usuario no activo.")

        user = authenticate(username=username, password=attrs.get("password"))
        if not user:
            raise serializers.ValidationError("Credenciales inválidas.")
        return super().validate({**attrs, "username": username})


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = ("id", "username", "full_name", "document", "role", "is_active", "password")
        read_only_fields = ("id",)

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        user.set_password(password or User.objects.make_random_password())
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
