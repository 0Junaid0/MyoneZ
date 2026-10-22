from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    detail = response.data
    response.data = {
        "error": {
            "code": getattr(exc, "default_code", "request_error"),
            "detail": detail,
            "status": response.status_code,
        }
    }
    return response
