"""
Secret types for dhi - Pydantic v2 compatible.

Provides types that hide sensitive values in repr/str output.

Example:
    from dhi import BaseModel, SecretStr, SecretBytes

    class Config(BaseModel):
        api_key: SecretStr
        token: SecretBytes

    config = Config(api_key="sk-abc123", token=b"secret")
    print(config.api_key)  # SecretStr('**********')
    print(config.api_key.get_secret_value())  # 'sk-abc123'
"""

from typing import Any

from .validator import ValidationError


class SecretStr:
    """A string that hides its value in repr() and str().

    Matches Pydantic's SecretStr type.
    """

    __slots__ = ('_secret_value',)

    def __init__(self, value: Any) -> None:
        if isinstance(value, SecretStr):
            object.__setattr__(self, '_secret_value', value.get_secret_value())
        elif isinstance(value, str):
            object.__setattr__(self, '_secret_value', value)
        else:
            raise ValidationError("value", f"Expected str, got {type(value).__name__}")

    def get_secret_value(self) -> str:
        """Get the actual secret value."""
        return self._secret_value

    def __repr__(self) -> str:
        return "SecretStr('**********')"

    def __str__(self) -> str:
        return '**********'

    def __len__(self) -> int:
        return len(self._secret_value)

    def __eq__(self, other: object) -> bool:
        if isinstance(other, SecretStr):
            return self._secret_value == other._secret_value
        return NotImplemented

    def __hash__(self) -> int:
        return hash(self._secret_value)

    def __bool__(self) -> bool:
        return bool(self._secret_value)


class SecretBytes:
    """Bytes that hide their value in repr() and str().

    Matches Pydantic's SecretBytes type.
    """

    __slots__ = ('_secret_value',)

    def __init__(self, value: Any) -> None:
        if isinstance(value, SecretBytes):
            object.__setattr__(self, '_secret_value', value.get_secret_value())
        elif isinstance(value, bytes):
            object.__setattr__(self, '_secret_value', value)
        else:
            raise ValidationError("value", f"Expected bytes, got {type(value).__name__}")

    def get_secret_value(self) -> bytes:
        """Get the actual secret value."""
        return self._secret_value

    def __repr__(self) -> str:
        return "SecretBytes(b'**********')"

    def __str__(self) -> str:
        return '**********'

    def __len__(self) -> int:
        return len(self._secret_value)

    def __eq__(self, other: object) -> bool:
        if isinstance(other, SecretBytes):
            return self._secret_value == other._secret_value
        return NotImplemented

    def __hash__(self) -> int:
        return hash(self._secret_value)

    def __bool__(self) -> bool:
        return bool(self._secret_value)


__all__ = ["SecretStr", "SecretBytes"]
