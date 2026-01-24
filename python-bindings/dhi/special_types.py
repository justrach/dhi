"""
Special types for dhi - Pydantic v2 compatible.

Provides UUID, Path, Base64, Json, ByteSize, and other specialized
validation types matching Pydantic's type system.

Example:
    from dhi import BaseModel, UUID4, FilePath, Json, Base64Str

    class Document(BaseModel):
        id: UUID4
        path: FilePath
        metadata: Json
        encoded: Base64Str
"""

import uuid
import base64
import json as json_module
from pathlib import Path
from typing import Annotated, Any

from .validator import ValidationError


# ============================================================
# UUID Validators
# ============================================================

class _UUIDVersionValidator:
    """Validates UUID version."""

    __slots__ = ('version',)

    def __init__(self, version: int):
        self.version = version

    def __repr__(self) -> str:
        return f"UUIDVersionValidator(version={self.version})"

    def validate(self, value: Any, field_name: str = "value") -> uuid.UUID:
        if isinstance(value, str):
            try:
                value = uuid.UUID(value)
            except ValueError:
                raise ValidationError(field_name, f"Invalid UUID string: {value!r}")
        if not isinstance(value, uuid.UUID):
            raise ValidationError(field_name, f"Expected UUID, got {type(value).__name__}")
        if value.version != self.version:
            raise ValidationError(
                field_name,
                f"Expected UUID version {self.version}, got version {value.version}"
            )
        return value


class _UUIDValidator:
    """Validates any UUID (no version constraint)."""

    def __repr__(self) -> str:
        return "UUIDValidator()"

    def validate(self, value: Any, field_name: str = "value") -> uuid.UUID:
        if isinstance(value, str):
            try:
                value = uuid.UUID(value)
            except ValueError:
                raise ValidationError(field_name, f"Invalid UUID string: {value!r}")
        if not isinstance(value, uuid.UUID):
            raise ValidationError(field_name, f"Expected UUID, got {type(value).__name__}")
        return value


# ============================================================
# Path Validators
# ============================================================

class _FilePathValidator:
    """Validates that a path points to an existing file."""

    def __repr__(self) -> str:
        return "FilePathValidator()"

    def validate(self, value: Any, field_name: str = "value") -> Path:
        if isinstance(value, str):
            value = Path(value)
        if not isinstance(value, Path):
            raise ValidationError(field_name, f"Expected path, got {type(value).__name__}")
        if not value.exists():
            raise ValidationError(field_name, f"Path does not exist: {value}")
        if not value.is_file():
            raise ValidationError(field_name, f"Path is not a file: {value}")
        return value


class _DirectoryPathValidator:
    """Validates that a path points to an existing directory."""

    def __repr__(self) -> str:
        return "DirectoryPathValidator()"

    def validate(self, value: Any, field_name: str = "value") -> Path:
        if isinstance(value, str):
            value = Path(value)
        if not isinstance(value, Path):
            raise ValidationError(field_name, f"Expected path, got {type(value).__name__}")
        if not value.exists():
            raise ValidationError(field_name, f"Path does not exist: {value}")
        if not value.is_dir():
            raise ValidationError(field_name, f"Path is not a directory: {value}")
        return value


class _NewPathValidator:
    """Validates that a path does NOT already exist (for new file/dir creation)."""

    def __repr__(self) -> str:
        return "NewPathValidator()"

    def validate(self, value: Any, field_name: str = "value") -> Path:
        if isinstance(value, str):
            value = Path(value)
        if not isinstance(value, Path):
            raise ValidationError(field_name, f"Expected path, got {type(value).__name__}")
        if value.exists():
            raise ValidationError(field_name, f"Path already exists: {value}")
        # Parent directory should exist
        if not value.parent.exists():
            raise ValidationError(field_name, f"Parent directory does not exist: {value.parent}")
        return value


# ============================================================
# Base64 Validators
# ============================================================

class _Base64BytesValidator:
    """Validates and decodes base64-encoded bytes."""

    def __repr__(self) -> str:
        return "Base64BytesValidator()"

    def validate(self, value: Any, field_name: str = "value") -> bytes:
        if isinstance(value, bytes):
            data = value
        elif isinstance(value, str):
            data = value.encode('ascii')
        else:
            raise ValidationError(field_name, f"Expected str or bytes, got {type(value).__name__}")
        try:
            return base64.b64decode(data, validate=True)
        except Exception:
            raise ValidationError(field_name, "Invalid base64 encoding")


class _Base64StrValidator:
    """Validates and decodes base64-encoded string."""

    def __repr__(self) -> str:
        return "Base64StrValidator()"

    def validate(self, value: Any, field_name: str = "value") -> str:
        if not isinstance(value, str):
            raise ValidationError(field_name, f"Expected str, got {type(value).__name__}")
        try:
            decoded = base64.b64decode(value.encode('ascii'), validate=True)
            return decoded.decode('utf-8')
        except Exception:
            raise ValidationError(field_name, "Invalid base64 encoding")


class _Base64UrlBytesValidator:
    """Validates and decodes URL-safe base64-encoded bytes."""

    def __repr__(self) -> str:
        return "Base64UrlBytesValidator()"

    def validate(self, value: Any, field_name: str = "value") -> bytes:
        if isinstance(value, bytes):
            data = value
        elif isinstance(value, str):
            data = value.encode('ascii')
        else:
            raise ValidationError(field_name, f"Expected str or bytes, got {type(value).__name__}")
        try:
            # Add padding if needed
            padding = 4 - len(data) % 4
            if padding != 4:
                data += b'=' * padding if isinstance(data, bytes) else ('=' * padding).encode()
            return base64.urlsafe_b64decode(data)
        except Exception:
            raise ValidationError(field_name, "Invalid URL-safe base64 encoding")


class _Base64UrlStrValidator:
    """Validates and decodes URL-safe base64-encoded string."""

    def __repr__(self) -> str:
        return "Base64UrlStrValidator()"

    def validate(self, value: Any, field_name: str = "value") -> str:
        if not isinstance(value, str):
            raise ValidationError(field_name, f"Expected str, got {type(value).__name__}")
        try:
            # Add padding if needed
            padding = 4 - len(value) % 4
            if padding != 4:
                value += '=' * padding
            decoded = base64.urlsafe_b64decode(value.encode('ascii'))
            return decoded.decode('utf-8')
        except Exception:
            raise ValidationError(field_name, "Invalid URL-safe base64 encoding")


# ============================================================
# Json Validator
# ============================================================

class _JsonValidator:
    """Validates that a string is valid JSON and parses it."""

    def __repr__(self) -> str:
        return "JsonValidator()"

    def validate(self, value: Any, field_name: str = "value") -> Any:
        if not isinstance(value, str):
            raise ValidationError(field_name, f"Expected str, got {type(value).__name__}")
        try:
            return json_module.loads(value)
        except json_module.JSONDecodeError as e:
            raise ValidationError(field_name, f"Invalid JSON: {e}")


# ============================================================
# ImportString Validator
# ============================================================

class _ImportStringValidator:
    """Validates that a string is a valid Python import path and imports it."""

    def __repr__(self) -> str:
        return "ImportStringValidator()"

    def validate(self, value: Any, field_name: str = "value") -> Any:
        if not isinstance(value, str):
            raise ValidationError(field_name, f"Expected str, got {type(value).__name__}")
        try:
            module_path, _, attr_name = value.rpartition('.')
            if not module_path:
                # Simple module import
                import importlib
                return importlib.import_module(value)
            else:
                import importlib
                module = importlib.import_module(module_path)
                return getattr(module, attr_name)
        except (ImportError, AttributeError) as e:
            raise ValidationError(field_name, f"Cannot import '{value}': {e}")


# ============================================================
# ByteSize
# ============================================================

class ByteSize(int):
    """Represents a size in bytes with human-readable parsing.

    Matches Pydantic's ByteSize type.

    Supports parsing strings like '1kb', '2.5 MB', '1GiB'.
    """

    _UNITS = {
        'b': 1,
        'kb': 1000, 'kib': 1024,
        'mb': 1000**2, 'mib': 1024**2,
        'gb': 1000**3, 'gib': 1024**3,
        'tb': 1000**4, 'tib': 1024**4,
        'pb': 1000**5, 'pib': 1024**5,
    }

    def __new__(cls, value: Any) -> 'ByteSize':
        if isinstance(value, (int, float)):
            return super().__new__(cls, int(value))
        if isinstance(value, str):
            return cls._parse_str(value)
        raise ValidationError("value", f"Expected int or size string, got {type(value).__name__}")

    @classmethod
    def _parse_str(cls, value: str) -> 'ByteSize':
        import re
        value = value.strip().lower()
        match = re.match(r'^(\d+(?:\.\d+)?)\s*([a-z]*)', value)
        if not match:
            raise ValidationError("value", f"Cannot parse byte size: {value!r}")
        number = float(match.group(1))
        unit = match.group(2) or 'b'
        if unit not in cls._UNITS:
            raise ValidationError("value", f"Unknown byte size unit: {unit!r}")
        return super().__new__(cls, int(number * cls._UNITS[unit]))

    def human_readable(self, decimal: bool = False) -> str:
        """Convert to human-readable string."""
        if decimal:
            units = [('PB', 1000**5), ('TB', 1000**4), ('GB', 1000**3),
                     ('MB', 1000**2), ('KB', 1000), ('B', 1)]
        else:
            units = [('PiB', 1024**5), ('TiB', 1024**4), ('GiB', 1024**3),
                     ('MiB', 1024**2), ('KiB', 1024), ('B', 1)]

        for suffix, divisor in units:
            if abs(self) >= divisor:
                value = self / divisor
                if value == int(value):
                    return f"{int(value)}{suffix}"
                return f"{value:.1f}{suffix}"
        return f"{int(self)}B"


# ============================================================
# Public Type Aliases
# ============================================================

# UUID types
UUID1 = Annotated[uuid.UUID, _UUIDVersionValidator(1)]
UUID3 = Annotated[uuid.UUID, _UUIDVersionValidator(3)]
UUID4 = Annotated[uuid.UUID, _UUIDVersionValidator(4)]
UUID5 = Annotated[uuid.UUID, _UUIDVersionValidator(5)]

# Path types
FilePath = Annotated[Path, _FilePathValidator()]
DirectoryPath = Annotated[Path, _DirectoryPathValidator()]
NewPath = Annotated[Path, _NewPathValidator()]

# Base64 types
Base64Bytes = Annotated[bytes, _Base64BytesValidator()]
Base64Str = Annotated[str, _Base64StrValidator()]
Base64UrlBytes = Annotated[bytes, _Base64UrlBytesValidator()]
Base64UrlStr = Annotated[str, _Base64UrlStrValidator()]

# Json type
Json = Annotated[str, _JsonValidator()]

# ImportString type
ImportString = Annotated[str, _ImportStringValidator()]


__all__ = [
    # UUID
    "UUID1", "UUID3", "UUID4", "UUID5",
    # Path
    "FilePath", "DirectoryPath", "NewPath",
    # Base64
    "Base64Bytes", "Base64Str", "Base64UrlBytes", "Base64UrlStr",
    # Others
    "Json", "ImportString", "ByteSize",
    # Secret (re-exported)
    "SecretStr", "SecretBytes",
]
