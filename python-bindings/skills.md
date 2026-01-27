# dhi Python Skills Guide

Ultra-fast validation library for Python. **520x faster than Pydantic** with full API compatibility.

## Quick Start

```bash
pip install dhi
```

```python
from typing import Annotated
from dhi import BaseModel, Field, PositiveInt, EmailStr

class User(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: EmailStr
    age: PositiveInt

# Validation
user = User(name="Alice", email="alice@example.com", age=25)
print(user.model_dump())  # {'name': 'Alice', 'email': 'alice@example.com', 'age': 25}
```

## Core Features

### BaseModel

```python
from typing import Annotated, Optional, List
from dhi import BaseModel, Field, ConfigDict

class User(BaseModel):
    # Optional frozen model
    model_config = ConfigDict(frozen=True)

    # Required fields
    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: str

    # Optional fields with defaults
    age: Optional[int] = None
    tags: List[str] = Field(default_factory=list)

# Create instance
user = User(name="Alice", email="alice@example.com")

# Pydantic v2 compatible methods
user.model_dump()                    # Dict output
user.model_dump_json()               # JSON string
user.model_copy(update={'name': 'Bob'})  # Copy with updates
User.model_validate({'name': 'Alice', 'email': 'a@b.com'})  # Validate dict
User.model_validate_json('{"name": "Alice", "email": "a@b.com"}')  # Validate JSON
User.model_construct(name='Alice', email='a@b.com')  # Skip validation
```

### Type Aliases

```python
from dhi import (
    # Strict types (no coercion)
    StrictInt, StrictFloat, StrictStr, StrictBool, StrictBytes,

    # Positive/Negative numbers
    PositiveInt, NegativeInt, NonNegativeInt, NonPositiveInt,
    PositiveFloat, NegativeFloat, NonNegativeFloat, NonPositiveFloat,
    FiniteFloat,  # No Infinity/NaN
)

class Model(BaseModel):
    count: PositiveInt          # Must be > 0
    score: NonNegativeFloat     # Must be >= 0
    strict_name: StrictStr      # No type coercion
```

### Constraint Functions (con*)

```python
from dhi import conint, confloat, constr, conlist, condecimal

# Integer with range
Score = conint(ge=0, le=100)

# Float with constraints
Probability = confloat(ge=0.0, le=1.0)

# String with constraints
Username = constr(min_length=3, max_length=20, to_lower=True)

# List with constraints
Tags = conlist(str, min_length=1, max_length=10, unique_items=True)

class Model(BaseModel):
    score: Score
    probability: Probability
    username: Username
    tags: Tags
```

### Field Constraints

```python
from typing import Annotated
from dhi import BaseModel, Field

class User(BaseModel):
    # Numeric constraints
    age: Annotated[int, Field(gt=0, le=120)]
    score: Annotated[float, Field(ge=0, le=100, multiple_of=0.5)]

    # String constraints
    name: Annotated[str, Field(min_length=1, max_length=100)]
    code: Annotated[str, Field(pattern=r'^[A-Z]{3}\d{3}$')]

    # String transformations
    username: Annotated[str, Field(strip_whitespace=True, to_lower=True)]

    # Aliases
    user_id: Annotated[str, Field(alias='userId')]

    # Frozen field (immutable after creation)
    id: Annotated[str, Field(frozen=True)]

    # Exclude from serialization
    password: Annotated[str, Field(exclude=True)]

    # Metadata for JSON Schema
    email: Annotated[str, Field(
        title="Email Address",
        description="User's primary email",
        examples=["alice@example.com"]
    )]
```

### Network Types

```python
from dhi import (
    # Email
    EmailStr, NameEmail,

    # URLs
    AnyUrl, HttpUrl, AnyHttpUrl, FileUrl, FtpUrl,
    WebsocketUrl, AnyWebsocketUrl,

    # Database DSNs
    PostgresDsn, MySQLDsn, MariaDBDsn, MongoDsn,
    RedisDsn, ClickHouseDsn, CockroachDsn,
    AmqpDsn, KafkaDsn, NatsDsn, SnowflakeDsn,

    # IP Addresses
    IPvAnyAddress, IPvAnyInterface, IPvAnyNetwork,
)

class Server(BaseModel):
    url: HttpUrl
    admin_email: EmailStr
    database: PostgresDsn
    ip: IPvAnyAddress
```

### Special Types

```python
from dhi import (
    # UUIDs
    UUID1, UUID3, UUID4, UUID5,

    # Paths
    FilePath, DirectoryPath, NewPath,

    # Base64
    Base64Bytes, Base64Str, Base64UrlBytes, Base64UrlStr,

    # JSON
    Json,

    # Secrets (masked in repr/logs)
    SecretStr, SecretBytes,

    # Byte size parsing
    ByteSize,

    # Import strings
    ImportString,
)

class Document(BaseModel):
    id: UUID4
    config_file: FilePath
    metadata: Json  # Parses JSON string to Python object

class Config(BaseModel):
    max_size: ByteSize  # Accepts "1GB", "500MB", etc.

# ByteSize usage
size = ByteSize("1.5 GB")
print(size)  # 1500000000
print(size.human_readable())  # "1.4GiB"
```

### Datetime Types

```python
from dhi import (
    PastDate, FutureDate, PastDatetime, FutureDatetime,
    AwareDatetime, NaiveDatetime,
)

class Event(BaseModel):
    created_at: PastDatetime
    scheduled_for: FutureDatetime
    local_time: NaiveDatetime  # No timezone
    utc_time: AwareDatetime    # With timezone
```

### Nested Models

```python
from typing import List
from dhi import BaseModel

class Address(BaseModel):
    street: str
    city: str
    country: str

class User(BaseModel):
    name: str
    address: Address  # Nested model
    addresses: List[Address]  # List of nested models

# Auto-converts dicts to models
user = User(
    name="Alice",
    address={"street": "123 Main", "city": "NYC", "country": "US"},
    addresses=[
        {"street": "456 Oak", "city": "LA", "country": "US"},
    ]
)
```

### ConfigDict Options

```python
from dhi import BaseModel, ConfigDict

class User(BaseModel):
    model_config = ConfigDict(
        # Immutable model
        frozen=True,

        # Extra field handling
        extra='forbid',  # 'ignore' | 'allow' | 'forbid'

        # Re-validate on assignment
        validate_assignment=True,

        # Strict mode (no type coercion)
        strict=True,

        # String transformations
        str_strip_whitespace=True,
        str_to_lower=True,

        # ORM mode
        from_attributes=True,
    )

    name: str
    email: str
```

### Field Validators

```python
from dhi import BaseModel, field_validator, model_validator

class User(BaseModel):
    name: str
    email: str
    password: str

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.title()

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        if '@' not in v:
            raise ValueError("Invalid email")
        return v.lower()

    @model_validator(mode='after')
    def validate_model(self):
        if self.name.lower() in self.password.lower():
            raise ValueError("Password cannot contain name")
        return self
```

### Private Attributes

```python
from dhi import BaseModel, PrivateAttr

class Model(BaseModel):
    name: str
    _cache: dict = PrivateAttr(default_factory=dict)
    _initialized: bool = PrivateAttr(default=False)

    def model_post_init(self, __context):
        self._initialized = True
```

### Computed Fields

```python
from dhi import BaseModel, computed_field

class Rectangle(BaseModel):
    width: float
    height: float

    @computed_field
    @property
    def area(self) -> float:
        return self.width * self.height

rect = Rectangle(width=10, height=5)
print(rect.area)  # 50.0
print(rect.model_dump())  # {'width': 10, 'height': 5, 'area': 50.0}
```

## High-Performance Batch Validation

For maximum performance with large datasets, use the native batch API:

```python
from dhi import _dhi_native

users = [
    {"name": "Alice", "email": "alice@example.com", "age": 25},
    {"name": "Bob", "email": "bob@example.com", "age": 30},
    # ... thousands more
]

field_specs = {
    'name': ('string', 2, 100),      # string with length 2-100
    'email': ('email',),              # email validation
    'age': ('int_positive',),         # positive integer
}

results, valid_count = _dhi_native.validate_batch_direct(users, field_specs)
print(f"Valid: {valid_count}/{len(users)}")
# 28 million validations/second!
```

### Available Native Validators

| Validator | Spec Format | Description |
|-----------|-------------|-------------|
| `string` | `('string', min, max)` | String with length bounds |
| `email` | `('email',)` | Email format |
| `url` | `('url',)` | URL format |
| `uuid` | `('uuid',)` | UUID format |
| `ipv4` | `('ipv4',)` | IPv4 address |
| `base64` | `('base64',)` | Base64 encoded |
| `iso_date` | `('iso_date',)` | ISO date format |
| `iso_datetime` | `('iso_datetime',)` | ISO datetime format |
| `int` | `('int',)` | Any integer |
| `int_gt` | `('int_gt', n)` | Integer > n |
| `int_gte` | `('int_gte', n)` | Integer >= n |
| `int_lt` | `('int_lt', n)` | Integer < n |
| `int_lte` | `('int_lte', n)` | Integer <= n |
| `int_positive` | `('int_positive',)` | Integer > 0 |
| `int_non_negative` | `('int_non_negative',)` | Integer >= 0 |
| `int_multiple_of` | `('int_multiple_of', n)` | Integer divisible by n |

## Framework Integration

### FastAPI

```python
from fastapi import FastAPI
from dhi import BaseModel, Field, EmailStr, PositiveInt

app = FastAPI()

class CreateUser(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    age: PositiveInt

class UserResponse(BaseModel):
    id: str
    name: str
    email: str

@app.post("/users", response_model=UserResponse)
async def create_user(user: CreateUser):
    return UserResponse(
        id="123",
        name=user.name,
        email=user.email,
    )
```

### Django

```python
from dhi import BaseModel, Field, EmailStr

class UserSchema(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr

def create_user(request):
    try:
        data = UserSchema.model_validate_json(request.body)
        # Create user with validated data
        user = User.objects.create(
            name=data.name,
            email=data.email,
        )
        return JsonResponse({"id": user.id})
    except ValidationErrors as e:
        return JsonResponse({"errors": str(e)}, status=400)
```

### Flask

```python
from flask import Flask, request, jsonify
from dhi import BaseModel, Field, EmailStr

app = Flask(__name__)

class CreateUser(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr

@app.post("/users")
def create_user():
    try:
        user = CreateUser.model_validate(request.json)
        return jsonify({"id": "123", **user.model_dump()})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
```

## Benchmarks

```bash
cd python-bindings
python benchmark_vs_all.py
```

**Results:**

| Library | Speed | Comparison |
|---------|-------|------------|
| dhi | 28M/sec | - |
| satya (Rust) | 9M/sec | 3.0x slower |
| msgspec (C) | 9M/sec | 3.1x slower |
| Pydantic | 48K/sec | **520x slower** |

## Migration from Pydantic

dhi is a drop-in replacement for Pydantic v2:

```python
# Before
from pydantic import BaseModel, Field, EmailStr

# After
from dhi import BaseModel, Field, EmailStr

# Everything else stays the same!
```

## Error Handling

```python
from dhi import BaseModel, ValidationError, ValidationErrors

class User(BaseModel):
    name: str
    age: int

try:
    user = User(name="", age="invalid")
except ValidationErrors as e:
    for error in e.errors:
        print(f"{error.field}: {error.message}")
        # name: Length must be >= 1, got 0
        # age: Expected int, got str
```

## JSON Schema Generation

```python
from dhi import BaseModel, Field

class User(BaseModel):
    name: str = Field(min_length=1, description="User's name")
    age: int = Field(gt=0, le=120, description="User's age")

schema = User.model_json_schema()
print(schema)
# {
#   "title": "User",
#   "type": "object",
#   "properties": {
#     "name": {"type": "string", "minLength": 1, "description": "User's name"},
#     "age": {"type": "integer", "exclusiveMinimum": 0, "maximum": 120, "description": "User's age"}
#   },
#   "required": ["name", "age"]
# }
```

## Performance Tips

### 1. Define Models at Module Level

```python
# Good: Model compiled once at import
class User(BaseModel):
    name: str

def validate(data):
    return User.model_validate(data)  # Reuses compiled model

# Avoid: Creating model in function
def validate(data):
    class User(BaseModel):  # Recompiled each call!
        name: str
    return User.model_validate(data)
```

### 2. Use model_construct for Trusted Data

```python
# Skip validation for pre-validated/trusted data
user = User.model_construct(name="Alice", email="alice@example.com")
```

### 3. Use Batch API for Large Datasets

```python
# For thousands of records, use native batch API
results, count = _dhi_native.validate_batch_direct(records, specs)
```

### 4. Prefer Native Type Validators

```python
# Good: Uses SIMD-accelerated native validators
email: EmailStr
url: HttpUrl

# Less optimal: Custom regex (Python fallback)
email: str = Field(pattern=r'^[a-z]+@[a-z]+\.[a-z]+$')
```

## Troubleshooting

### Import Errors

```python
# Ensure you're importing from dhi, not pydantic
from dhi import BaseModel  # Correct
from pydantic import BaseModel  # Wrong package
```

### Type Errors

```python
# Use Annotated for complex constraints
from typing import Annotated
from dhi import Field

# Good
name: Annotated[str, Field(min_length=1)]

# Also works (Pydantic style)
name: str = Field(min_length=1)
```

### Validation Errors

```python
# Access error details
try:
    user = User(name="", age=-1)
except ValidationErrors as e:
    print(e.errors)  # List of ValidationError objects
    for err in e.errors:
        print(f"Field: {err.field}, Message: {err.message}")
```
