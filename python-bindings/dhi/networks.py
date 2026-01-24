"""
Network types for dhi - Pydantic v2 compatible.

Provides URL, email, IP address, and DSN validation types
matching Pydantic's network type system.

Example:
    from dhi import BaseModel, EmailStr, HttpUrl, IPvAnyAddress

    class Server(BaseModel):
        url: HttpUrl
        admin_email: EmailStr
        ip: IPvAnyAddress
"""

import re
import ipaddress
from typing import Annotated, Any, Optional, List

from .constraints import MaxLength
from .validator import ValidationError, HAS_NATIVE_EXT

# Try to get native extension for fast validation
_native = None
if HAS_NATIVE_EXT:
    try:
        from . import _dhi_native
        _native = _dhi_native
    except ImportError:
        pass


# ============================================================
# Internal Validator Classes (used as Annotated metadata)
# ============================================================

class _EmailValidator:
    """Validates email format."""

    _EMAIL_REGEX = re.compile(
        r'^[a-zA-Z0-9.!#$%&\'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}'
        r'[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
    )

    def __repr__(self) -> str:
        return "EmailValidator()"

    def validate(self, value: Any, field_name: str = "value") -> str:
        if not isinstance(value, str):
            raise ValidationError(field_name, f"Expected str, got {type(value).__name__}")
        # Use native extension for fast validation when available
        if _native is not None:
            if not _native.validate_email(value):
                raise ValidationError(field_name, f"Invalid email address: {value!r}")
            return value
        # Pure Python fallback
        if not self._EMAIL_REGEX.match(value):
            raise ValidationError(field_name, f"Invalid email address: {value!r}")
        # Must have at least one dot in domain
        local, domain = value.rsplit('@', 1)
        if '.' not in domain:
            raise ValidationError(field_name, f"Invalid email domain: {domain!r}")
        return value


class _NameEmailValidator:
    """Validates 'Display Name <email>' format."""

    _NAME_EMAIL_REGEX = re.compile(
        r'^(.+?)\s*<([^>]+)>$'
    )

    def __repr__(self) -> str:
        return "NameEmailValidator()"

    def validate(self, value: Any, field_name: str = "value") -> str:
        if not isinstance(value, str):
            raise ValidationError(field_name, f"Expected str, got {type(value).__name__}")
        # Try "Name <email>" format
        match = self._NAME_EMAIL_REGEX.match(value)
        if match:
            email = match.group(2)
            _EmailValidator().validate(email, field_name)
            return value
        # Try plain email format
        _EmailValidator().validate(value, field_name)
        return value


class _UrlValidator:
    """Validates URL format with optional scheme/length constraints."""

    def __init__(
        self,
        allowed_schemes: Optional[List[str]] = None,
        max_length: Optional[int] = None,
        host_required: bool = True,
        default_scheme: Optional[str] = None,
    ):
        self.allowed_schemes = allowed_schemes
        self.max_length = max_length
        self.host_required = host_required
        self.default_scheme = default_scheme
        # Build regex for URL validation
        self._url_regex = re.compile(
            r'^(?:([a-zA-Z][a-zA-Z0-9+.-]*):)?'  # scheme
            r'(?://)?'  # authority indicator
            r'([^/?#]*)'  # authority (host:port)
            r'([^?#]*)'  # path
            r'(?:\?([^#]*))?'  # query
            r'(?:#(.*))?$'  # fragment
        )

    def __repr__(self) -> str:
        return f"UrlValidator(allowed_schemes={self.allowed_schemes})"

    def validate(self, value: Any, field_name: str = "value") -> str:
        if not isinstance(value, str):
            raise ValidationError(field_name, f"Expected str, got {type(value).__name__}")

        if self.max_length and len(value) > self.max_length:
            raise ValidationError(
                field_name,
                f"URL length {len(value)} exceeds maximum {self.max_length}"
            )

        match = self._url_regex.match(value)
        if not match:
            raise ValidationError(field_name, f"Invalid URL: {value!r}")

        scheme = match.group(1)
        authority = match.group(2)

        # Validate scheme
        if self.allowed_schemes:
            if not scheme:
                if self.default_scheme:
                    scheme = self.default_scheme
                else:
                    raise ValidationError(
                        field_name,
                        f"URL must have a scheme from: {self.allowed_schemes}"
                    )
            if scheme.lower() not in [s.lower() for s in self.allowed_schemes]:
                raise ValidationError(
                    field_name,
                    f"URL scheme '{scheme}' not in allowed schemes: {self.allowed_schemes}"
                )

        # Validate host
        if self.host_required and not authority:
            raise ValidationError(field_name, f"URL must have a host: {value!r}")

        return value


class _IPAddressValidator:
    """Validates IPv4 or IPv6 address."""

    def __repr__(self) -> str:
        return "IPAddressValidator()"

    def validate(self, value: Any, field_name: str = "value") -> str:
        if not isinstance(value, str):
            raise ValidationError(field_name, f"Expected str, got {type(value).__name__}")
        try:
            ipaddress.ip_address(value)
        except ValueError:
            raise ValidationError(field_name, f"Invalid IP address: {value!r}")
        return value


class _IPInterfaceValidator:
    """Validates IPv4 or IPv6 interface (address/prefix)."""

    def __repr__(self) -> str:
        return "IPInterfaceValidator()"

    def validate(self, value: Any, field_name: str = "value") -> str:
        if not isinstance(value, str):
            raise ValidationError(field_name, f"Expected str, got {type(value).__name__}")
        try:
            ipaddress.ip_interface(value)
        except ValueError:
            raise ValidationError(field_name, f"Invalid IP interface: {value!r}")
        return value


class _IPNetworkValidator:
    """Validates IPv4 or IPv6 network (CIDR notation)."""

    def __repr__(self) -> str:
        return "IPNetworkValidator()"

    def validate(self, value: Any, field_name: str = "value") -> str:
        if not isinstance(value, str):
            raise ValidationError(field_name, f"Expected str, got {type(value).__name__}")
        try:
            ipaddress.ip_network(value, strict=False)
        except ValueError:
            raise ValidationError(field_name, f"Invalid IP network: {value!r}")
        return value


# ============================================================
# Public Type Aliases - Pydantic v2 compatible
# ============================================================

# Email types
EmailStr = Annotated[str, _EmailValidator()]
NameEmail = Annotated[str, _NameEmailValidator()]

# URL types
AnyUrl = Annotated[str, _UrlValidator(allowed_schemes=None, host_required=False)]
AnyHttpUrl = Annotated[str, _UrlValidator(allowed_schemes=['http', 'https'], host_required=True)]
HttpUrl = Annotated[str, _UrlValidator(allowed_schemes=['http', 'https'], max_length=2083, host_required=True)]
FileUrl = Annotated[str, _UrlValidator(allowed_schemes=['file'], host_required=False)]
FtpUrl = Annotated[str, _UrlValidator(allowed_schemes=['ftp'], host_required=True)]
WebsocketUrl = Annotated[str, _UrlValidator(allowed_schemes=['ws', 'wss'], max_length=2083, host_required=True)]
AnyWebsocketUrl = Annotated[str, _UrlValidator(allowed_schemes=['ws', 'wss'], host_required=True)]

# DSN types (Database connection strings)
PostgresDsn = Annotated[str, _UrlValidator(
    allowed_schemes=['postgres', 'postgresql', 'postgresql+asyncpg', 'postgresql+pg8000',
                     'postgresql+psycopg', 'postgresql+psycopg2', 'postgresql+psycopg2cffi',
                     'postgresql+py-postgresql', 'postgresql+pygresql'],
    host_required=True,
)]
CockroachDsn = Annotated[str, _UrlValidator(
    allowed_schemes=['cockroachdb', 'cockroachdb+psycopg2', 'cockroachdb+asyncpg'],
    host_required=True,
)]
MySQLDsn = Annotated[str, _UrlValidator(
    allowed_schemes=['mysql', 'mysql+mysqlconnector', 'mysql+aiomysql',
                     'mysql+asyncmy', 'mysql+mysqldb', 'mysql+pymysql',
                     'mysql+cymysql', 'mysql+pyodbc'],
    host_required=True,
)]
MariaDBDsn = Annotated[str, _UrlValidator(
    allowed_schemes=['mariadb', 'mariadb+mariadbconnector', 'mariadb+pymysql'],
    host_required=True,
)]
ClickHouseDsn = Annotated[str, _UrlValidator(
    allowed_schemes=['clickhouse+native', 'clickhouse+asynch'],
    host_required=True,
)]
MongoDsn = Annotated[str, _UrlValidator(
    allowed_schemes=['mongodb', 'mongodb+srv'],
    host_required=True,
)]
RedisDsn = Annotated[str, _UrlValidator(
    allowed_schemes=['redis', 'rediss'],
    host_required=True,
)]
AmqpDsn = Annotated[str, _UrlValidator(
    allowed_schemes=['amqp', 'amqps'],
    host_required=True,
)]
KafkaDsn = Annotated[str, _UrlValidator(
    allowed_schemes=['kafka', 'kafka+ssl'],
    host_required=True,
)]
NatsDsn = Annotated[str, _UrlValidator(
    allowed_schemes=['nats', 'tls', 'ws'],
    host_required=True,
)]
SnowflakeDsn = Annotated[str, _UrlValidator(
    allowed_schemes=['snowflake'],
    host_required=True,
)]

# IP Address types
IPvAnyAddress = Annotated[str, _IPAddressValidator()]
IPvAnyInterface = Annotated[str, _IPInterfaceValidator()]
IPvAnyNetwork = Annotated[str, _IPNetworkValidator()]


__all__ = [
    # Email
    "EmailStr", "NameEmail",
    # URLs
    "AnyUrl", "AnyHttpUrl", "HttpUrl", "FileUrl", "FtpUrl",
    "WebsocketUrl", "AnyWebsocketUrl",
    # DSNs
    "PostgresDsn", "CockroachDsn", "MySQLDsn", "MariaDBDsn",
    "ClickHouseDsn", "MongoDsn", "RedisDsn", "AmqpDsn",
    "KafkaDsn", "NatsDsn", "SnowflakeDsn",
    # IP
    "IPvAnyAddress", "IPvAnyInterface", "IPvAnyNetwork",
]
