"""Logging that can never write a CVV or card number to the log file.

CVV RULE - LAYER 7 (application logs)
  * We never log request bodies.
  * As a safety net, every log line passes through RedactingFilter, which masks
    anything that looks like a CVV field or a full card number before it is written.
"""
import logging
import os
import re

_SECRET_FIELD = re.compile(
    r'(?i)(["\']?\b(?:cvv2?|cvc2?|csc|security_?code|card_?number|card_?no|pan)["\']?\s*[:=]\s*)'
    r'("[^"]*"|\'[^\']*\'|[^,}\s]+)'          # a quoted value (spaces allowed) or a bare word
)
_CARD_DIGITS = re.compile(r'(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)')


def _luhn_ok(num: str) -> bool:
    digits = [int(d) for d in num if d.isdigit()]
    if not 13 <= len(digits) <= 19:
        return False
    total, dbl = 0, False
    for d in reversed(digits):
        if dbl:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        dbl = not dbl
    return total % 10 == 0


def redact(text: str) -> str:
    text = _CARD_DIGITS.sub(lambda m: "[CARD-REDACTED]" if _luhn_ok(m.group(0)) else m.group(0), text)
    return _SECRET_FIELD.sub(r'\1"[REDACTED]"', text)


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        record.msg = redact(message)
        record.args = ()
        return True


def setup_logging(log_file: str) -> None:
    os.makedirs(os.path.dirname(log_file) or ".", exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s - %(message)s")
    redactor = RedactingFilter()

    file_handler = logging.FileHandler(log_file)
    console = logging.StreamHandler()
    for h in (file_handler, console):
        h.setFormatter(fmt)
        h.addFilter(redactor)          # filter on the HANDLER = applies to every logger

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers = [file_handler, console]
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True
