---
name: dhi-python
description: Ultra-fast data validation library for Python (520x faster than Pydantic). Use when building validated data models, API request/response schemas, or configuration objects. Provides Pydantic v2-compatible BaseModel API with Zig-powered native validation.
dependencies: dhi>=1.1.3
license: MIT
---

# dhi - Ultra-Fast Python Validation

## Overview

dhi is a high-performance data validation library for Python, powered by Zig and native C extensions. It provides a **Pydantic v2-compatible API** while being **520x faster** for validation operations.

Use dhi when you need:
- Validated data models for APIs
- Fast request/response parsing
- Configuration object validation
- Type-safe data structures

---

## Installation

```bash
pip install dhi
```

---

## Quick Start

### Basic Model

```python
from dhi import BaseModel, Field
from typing import Annotated

class User(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    age: Annotated[int, Field(ge=0, le=120)]
    email: str
    score: float = 0.0

# Create and validate
user = User(name="Alice", age=25, email="alice@example.com")
print(user.model_dump())
# {'name': 'Alice', 'age': 25, 'email': 'alice@example.com', 'score': 0.0}
```

### Nested Models

```python
from dhi import BaseModel

class Address(BaseModel):
    street: str
    city: str
    zip_code: str

class Person(BaseModel):
    name: str
    address: Address  # Nested model

# Works with dict or pre-built model
person = Person(
    name="Bob",
    address={"street": "123 Main St", "city": "NYC", "zip_code": "10001"}
)
```

### Constrained Types

```python
from dhi import BaseModel, PositiveInt, EmailStr, HttpUrl
from typing import Annotated

class Account(BaseModel):
    user_id: PositiveInt
    email: EmailStr
    website: HttpUrl
    balance: Annotated[float, Field(ge=0)]
```

---

## Key Features

### Pydantic v2 Compatible API

```python
# All standard Pydantic methods work
user = User.model_validate({"name": "Alice", "age": 25, "email": "a@b.com"})
user_dict = user.model_dump()
user_json = user.model_dump_json()
user_copy = user.model_copy(update={"age": 26})
```

### ConfigDict Support

```python
from dhi import BaseModel, ConfigDict

class StrictUser(BaseModel):
    model_config = ConfigDict(
        strict=True,
        frozen=True,
        extra='forbid',
        str_strip_whitespace=True
    )

    name: str
    age: int
```

### Validators

```python
from dhi import BaseModel, field_validator, model_validator

class User(BaseModel):
    name: str
    password: str
    confirm_password: str

    @field_validator('name')
    @classmethod
    def name_must_be_alpha(cls, v):
        if not v.isalpha():
            raise ValueError('must be alphabetic')
        return v.title()

    @model_validator(mode='after')
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError('passwords do not match')
        return self
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
```

### Private Attributes

```python
from dhi import BaseModel, PrivateAttr

class Model(BaseModel):
    name: str
    _secret: str = PrivateAttr(default="hidden")
    _counter: int = PrivateAttr(default_factory=int)
```

---

## Available Constrained Types

### String Types
- `EmailStr` - Valid email addresses
- `HttpUrl` / `AnyUrl` - URL validation
- `IPvAnyAddress` - IP address validation

### Numeric Types
- `PositiveInt` / `NegativeInt`
- `PositiveFloat` / `NegativeFloat`
- `NonNegativeInt` / `NonPositiveInt`
- `StrictInt` / `StrictFloat` / `StrictBool`

### Other Types
- `SecretStr` / `SecretBytes` - Masked sensitive data
- `Json` - JSON string parsing
- `UUID` types

---

## Field Constraints

```python
from dhi import Field

# Numeric constraints
Field(gt=0)           # Greater than
Field(ge=0)           # Greater than or equal
Field(lt=100)         # Less than
Field(le=100)         # Less than or equal
Field(multiple_of=5)  # Must be multiple of

# String constraints
Field(min_length=1)
Field(max_length=100)
Field(pattern=r"^[a-z]+$")  # Regex pattern

# Other
Field(strict=True)    # No type coercion
Field(frozen=True)    # Immutable field
Field(exclude=True)   # Exclude from serialization
```

---

## Serialization Options

```python
user.model_dump(
    mode='json',           # JSON-compatible types
    by_alias=True,         # Use field aliases
    exclude_unset=True,    # Exclude fields not explicitly set
    exclude_defaults=True, # Exclude fields with default values
    exclude_none=True,     # Exclude None values
    include={'name'},      # Only include specific fields
    exclude={'password'},  # Exclude specific fields
)
```

---

## Performance

dhi is **520x faster** than Pydantic for validation operations:

| Operation | dhi | Pydantic | Speedup |
|-----------|-----|----------|---------|
| Basic model | 2.55M/sec | 2.16M/sec | 1.18x |
| Nested model | 2.59M/sec | 2.23M/sec | 1.16x |
| model_dump | 4.37M/sec | 1.97M/sec | 2.22x |
| model_dump_json | 2.56M/sec | 1.77M/sec | 1.45x |

---

## When to Use

Use dhi when:
- Building high-performance APIs (FastAPI, Flask, etc.)
- Processing large volumes of validated data
- Need Pydantic compatibility with better performance
- Building configuration systems with validation

---

## Migration from Pydantic

dhi is designed as a drop-in replacement:

```python
# Before (Pydantic)
from pydantic import BaseModel, Field

# After (dhi)
from dhi import BaseModel, Field
```

Most Pydantic v2 code works unchanged with dhi.

---

## Resources

- **PyPI**: https://pypi.org/project/dhi/
- **GitHub**: https://github.com/justrach/dhi
- **Documentation**: See README.md in repository
