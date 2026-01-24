"""
Date/time types for dhi - Pydantic v2 compatible.

Provides constrained date and datetime types matching Pydantic's
date/time type system.

Example:
    from dhi import BaseModel, PastDate, FutureDatetime, AwareDatetime

    class Event(BaseModel):
        created: PastDate
        scheduled: FutureDatetime
        meeting_time: AwareDatetime
"""

from datetime import date, datetime, timezone
from typing import Annotated, Any

from .validator import ValidationError


# ============================================================
# Internal Validator Classes
# ============================================================

class _PastValidator:
    """Validates that a date/datetime is in the past."""

    def __repr__(self) -> str:
        return "PastValidator()"

    def validate(self, value: Any, field_name: str = "value") -> Any:
        if isinstance(value, datetime):
            now = datetime.now(tz=value.tzinfo)
            if value >= now:
                raise ValidationError(field_name, f"Datetime must be in the past, got {value}")
        elif isinstance(value, date):
            if value >= date.today():
                raise ValidationError(field_name, f"Date must be in the past, got {value}")
        else:
            raise ValidationError(field_name, f"Expected date or datetime, got {type(value).__name__}")
        return value


class _FutureValidator:
    """Validates that a date/datetime is in the future."""

    def __repr__(self) -> str:
        return "FutureValidator()"

    def validate(self, value: Any, field_name: str = "value") -> Any:
        if isinstance(value, datetime):
            now = datetime.now(tz=value.tzinfo)
            if value <= now:
                raise ValidationError(field_name, f"Datetime must be in the future, got {value}")
        elif isinstance(value, date):
            if value <= date.today():
                raise ValidationError(field_name, f"Date must be in the future, got {value}")
        else:
            raise ValidationError(field_name, f"Expected date or datetime, got {type(value).__name__}")
        return value


class _AwareValidator:
    """Validates that a datetime is timezone-aware."""

    def __repr__(self) -> str:
        return "AwareValidator()"

    def validate(self, value: Any, field_name: str = "value") -> datetime:
        if not isinstance(value, datetime):
            raise ValidationError(field_name, f"Expected datetime, got {type(value).__name__}")
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            raise ValidationError(field_name, "Datetime must be timezone-aware")
        return value


class _NaiveValidator:
    """Validates that a datetime is timezone-naive."""

    def __repr__(self) -> str:
        return "NaiveValidator()"

    def validate(self, value: Any, field_name: str = "value") -> datetime:
        if not isinstance(value, datetime):
            raise ValidationError(field_name, f"Expected datetime, got {type(value).__name__}")
        if value.tzinfo is not None and value.tzinfo.utcoffset(value) is not None:
            raise ValidationError(field_name, "Datetime must be timezone-naive")
        return value


# ============================================================
# Public Type Aliases
# ============================================================

PastDate = Annotated[date, _PastValidator()]
FutureDate = Annotated[date, _FutureValidator()]
PastDatetime = Annotated[datetime, _PastValidator()]
FutureDatetime = Annotated[datetime, _FutureValidator()]
AwareDatetime = Annotated[datetime, _AwareValidator()]
NaiveDatetime = Annotated[datetime, _NaiveValidator()]


__all__ = [
    "PastDate", "FutureDate",
    "PastDatetime", "FutureDatetime",
    "AwareDatetime", "NaiveDatetime",
]
