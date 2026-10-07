"""Error responses that never leak what the client sent.

FastAPI's default 422 response echoes the rejected input ("input": "...").
If a client wrongly sent {"cvv": "123"}, that default would send the CVV back
and it could end up in proxy / client logs. We replace it with a clean message.
(CVV RULE - LAYER 6, continued)
"""
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("api.errors")

ERROR_CODES = {
    400: "BAD_REQUEST", 401: "UNAUTHORIZED", 402: "PAYMENT_FAILED", 403: "FORBIDDEN",
    404: "NOT_FOUND", 409: "CONFLICT", 422: "VALIDATION_ERROR", 429: "TOO_MANY_REQUESTS",
    500: "SERVER_ERROR",
}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        problems = []
        for err in exc.errors():
            field = ".".join(str(p) for p in err.get("loc", []) if p != "body")
            msg = "field not allowed" if err.get("type") == "extra_forbidden" else err.get("msg", "invalid")
            problems.append({"field": field, "error": msg})      # no 'input', no 'ctx'
        log.info("validation failed on %s %s fields=%s", request.method, request.url.path,
                 [p["field"] for p in problems])
        return JSONResponse(status_code=422, content={"detail": "Invalid request", "problems": problems})

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        if isinstance(exc.detail, dict):
            code = exc.detail.get("code") or ERROR_CODES.get(exc.status_code, "ERROR")
            msg = exc.detail.get("message") or exc.detail.get("detail") or "Request failed"
            return JSONResponse(status_code=exc.status_code, content={"code": code, "detail": msg, "message": msg}, headers=exc.headers)
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail, "message": exc.detail}, headers=exc.headers)

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        # log the error TYPE and path only - never the request body
        log.error("unhandled %s on %s %s", type(exc).__name__, request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Something went wrong"})
