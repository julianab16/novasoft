from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    if isinstance(exc, ProtectedError):
        return Response(
            {"error": {"detail": "No se puede eliminar porque tiene registros asociados."}},
            status=status.HTTP_400_BAD_REQUEST,
        )
    response = exception_handler(exc, context)
    if response is not None:
        data = response.data
        # Errores que no son por campo (lista o texto) se agrupan en `detail`.
        if not isinstance(data, dict):
            data = {"detail": data}
        response.data = {"error": data}
    return response
