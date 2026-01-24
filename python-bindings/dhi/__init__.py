"""
dhi - High-performance data validation for Python, powered by Zig

A Python validation library with Pydantic v2 compatible API and
blazing-fast native performance via Zig/C extensions.

Example:
    from typing import Annotated
    from dhi import BaseModel, Field, PositiveInt, EmailStr

    class User(BaseModel):
        name: Annotated[str, Field(min_length=1, max_length=100)]
        age: PositiveInt
        email: EmailStr
        score: Annotated[float, Field(ge=0, le=100)] = 0.0

    user = User(name="Alice", age=25, email="alice@example.com")
"""

__version__ = "0.2.0"
__author__ = "Rach Pradhan"

# --- Core validators (original API) ---
from .validator import (
    BoundedInt,
    BoundedString,
    Email,
    ValidationError,
    ValidationErrors,
    HAS_NATIVE_EXT,
)

# --- Batch API ---
from .batch import (
    BatchValidationResult,
    validate_users_batch,
    validate_ints_batch,
    validate_strings_batch,
    validate_emails_batch,
)

# --- Constraints (Pydantic v2 compatible) ---
from .constraints import (
    Gt, Ge, Lt, Le, MultipleOf,
    MinLength, MaxLength, Pattern,
    Strict, StripWhitespace, ToLower, ToUpper,
    AllowInfNan, MaxDigits, DecimalPlaces, UniqueItems,
    StringConstraints,
)

# --- Field ---
from .fields import Field, FieldInfo

# --- Type aliases (Pydantic v2 compatible) ---
from .types import (
    # Strict types
    StrictInt, StrictFloat, StrictStr, StrictBool, StrictBytes,
    # Positive/Negative integers
    PositiveInt, NegativeInt, NonNegativeInt, NonPositiveInt,
    # Positive/Negative floats
    PositiveFloat, NegativeFloat, NonNegativeFloat, NonPositiveFloat,
    FiniteFloat,
    # con* functions
    conint, confloat, constr, conbytes,
    conlist, conset, confrozenset,
    condecimal, condate,
)

# --- BaseModel ---
from .model import BaseModel

# --- Network types ---
from .networks import (
    EmailStr, NameEmail,
    AnyUrl, AnyHttpUrl, HttpUrl, FileUrl, FtpUrl,
    WebsocketUrl, AnyWebsocketUrl,
    PostgresDsn, CockroachDsn, MySQLDsn, MariaDBDsn,
    ClickHouseDsn, MongoDsn, RedisDsn, AmqpDsn,
    KafkaDsn, NatsDsn, SnowflakeDsn,
    IPvAnyAddress, IPvAnyInterface, IPvAnyNetwork,
)

# --- Date/Time types ---
from .datetime_types import (
    PastDate, FutureDate,
    PastDatetime, FutureDatetime,
    AwareDatetime, NaiveDatetime,
)

# --- Functional validators ---
from .functional_validators import (
    field_validator, model_validator, validator,
)

# --- Secret types ---
from .secret import SecretStr, SecretBytes

# --- Special types ---
from .special_types import (
    UUID1, UUID3, UUID4, UUID5,
    FilePath, DirectoryPath, NewPath,
    Base64Bytes, Base64Str, Base64UrlBytes, Base64UrlStr,
    Json, ImportString, ByteSize,
)

# Try to import native extension
try:
    from . import _dhi_native
except ImportError:
    _dhi_native = None


__all__ = [
    # Core validators (original API)
    "BoundedInt", "BoundedString", "Email",
    "ValidationError", "ValidationErrors",
    "HAS_NATIVE_EXT", "_dhi_native",

    # Batch validation
    "BatchValidationResult",
    "validate_users_batch", "validate_ints_batch",
    "validate_strings_batch", "validate_emails_batch",

    # Constraints
    "Gt", "Ge", "Lt", "Le", "MultipleOf",
    "MinLength", "MaxLength", "Pattern",
    "Strict", "StripWhitespace", "ToLower", "ToUpper",
    "AllowInfNan", "MaxDigits", "DecimalPlaces", "UniqueItems",
    "StringConstraints",

    # Field
    "Field", "FieldInfo",

    # Type aliases
    "StrictInt", "StrictFloat", "StrictStr", "StrictBool", "StrictBytes",
    "PositiveInt", "NegativeInt", "NonNegativeInt", "NonPositiveInt",
    "PositiveFloat", "NegativeFloat", "NonNegativeFloat", "NonPositiveFloat",
    "FiniteFloat",

    # con* functions
    "conint", "confloat", "constr", "conbytes",
    "conlist", "conset", "confrozenset",
    "condecimal", "condate",

    # BaseModel
    "BaseModel",

    # Network types
    "EmailStr", "NameEmail",
    "AnyUrl", "AnyHttpUrl", "HttpUrl", "FileUrl", "FtpUrl",
    "WebsocketUrl", "AnyWebsocketUrl",
    "PostgresDsn", "CockroachDsn", "MySQLDsn", "MariaDBDsn",
    "ClickHouseDsn", "MongoDsn", "RedisDsn", "AmqpDsn",
    "KafkaDsn", "NatsDsn", "SnowflakeDsn",
    "IPvAnyAddress", "IPvAnyInterface", "IPvAnyNetwork",

    # Date/Time types
    "PastDate", "FutureDate",
    "PastDatetime", "FutureDatetime",
    "AwareDatetime", "NaiveDatetime",

    # Functional validators
    "field_validator", "model_validator", "validator",

    # Secret types
    "SecretStr", "SecretBytes",

    # Special types
    "UUID1", "UUID3", "UUID4", "UUID5",
    "FilePath", "DirectoryPath", "NewPath",
    "Base64Bytes", "Base64Str", "Base64UrlBytes", "Base64UrlStr",
    "Json", "ImportString", "ByteSize",
]
