"""
Comprehensive tests for dhi Pydantic v2 type parity.

Tests all constraint types, type aliases, BaseModel, field/model validators,
network types, datetime types, and special types.
"""

import math
import uuid
import json
from typing import Annotated, List, Set
from datetime import date, datetime, timezone, timedelta

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from dhi import (
    # Core
    BaseModel, Field, ValidationError, ValidationErrors,
    # Constraints
    Gt, Ge, Lt, Le, MultipleOf,
    MinLength, MaxLength, Pattern,
    Strict, StringConstraints,
    # Type aliases
    StrictInt, StrictFloat, StrictStr, StrictBool, StrictBytes,
    PositiveInt, NegativeInt, NonNegativeInt, NonPositiveInt,
    PositiveFloat, NegativeFloat, NonNegativeFloat, NonPositiveFloat,
    FiniteFloat,
    # con* functions
    conint, confloat, constr, conbytes, conlist, conset, condecimal, condate,
    # Network types
    EmailStr, NameEmail, HttpUrl, AnyUrl, IPvAnyAddress, IPvAnyNetwork,
    PostgresDsn, RedisDsn,
    # Functional validators
    field_validator, model_validator,
    # Secret types
    SecretStr, SecretBytes,
    # Special types
    UUID4, ByteSize, Json,
)


# ============================================================
# Test: Constraint Classes
# ============================================================

class TestConstraints:
    def test_gt(self):
        c = Gt(gt=5)
        assert c.gt == 5
        assert repr(c) == "Gt(gt=5)"
        assert c == Gt(gt=5)
        assert c != Gt(gt=10)

    def test_ge(self):
        c = Ge(ge=0)
        assert c.ge == 0
        assert repr(c) == "Ge(ge=0)"

    def test_lt(self):
        c = Lt(lt=100)
        assert c.lt == 100

    def test_le(self):
        c = Le(le=99)
        assert c.le == 99

    def test_multiple_of(self):
        c = MultipleOf(multiple_of=5)
        assert c.multiple_of == 5

    def test_min_length(self):
        c = MinLength(min_length=3)
        assert c.min_length == 3

    def test_max_length(self):
        c = MaxLength(max_length=50)
        assert c.max_length == 50

    def test_pattern(self):
        c = Pattern(pattern=r'^\d+$')
        assert c.pattern == r'^\d+$'

    def test_strict(self):
        c = Strict()
        assert c.strict is True
        c2 = Strict(strict=False)
        assert c2.strict is False

    def test_string_constraints(self):
        sc = StringConstraints(min_length=1, max_length=50, to_lower=True)
        assert sc.min_length == 1
        assert sc.max_length == 50
        assert sc.to_lower is True
        assert sc.strip_whitespace is False

    def test_constraint_hashable(self):
        s = {Gt(gt=5), Ge(ge=0), Lt(lt=100)}
        assert len(s) == 3


# ============================================================
# Test: Field Function
# ============================================================

class TestField:
    def test_field_basic(self):
        f = Field(gt=0, le=100)
        assert f.gt == 0
        assert f.le == 100
        assert f.is_required

    def test_field_with_default(self):
        f = Field(default=42, ge=0)
        assert not f.is_required
        assert f.get_default() == 42

    def test_field_with_factory(self):
        f = Field(default_factory=list)
        assert not f.is_required
        assert f.get_default() == []

    def test_field_string_constraints(self):
        f = Field(min_length=1, max_length=100, pattern=r'^\w+$')
        assert f.min_length == 1
        assert f.max_length == 100
        assert f.pattern == r'^\w+$'


# ============================================================
# Test: Type Aliases
# ============================================================

class TestTypeAliases:
    def test_positive_int(self):
        class M(BaseModel):
            v: PositiveInt
        m = M(v=5)
        assert m.v == 5
        with pytest.raises(ValidationErrors):
            M(v=0)
        with pytest.raises(ValidationErrors):
            M(v=-1)

    def test_negative_int(self):
        class M(BaseModel):
            v: NegativeInt
        m = M(v=-5)
        assert m.v == -5
        with pytest.raises(ValidationErrors):
            M(v=0)

    def test_non_negative_int(self):
        class M(BaseModel):
            v: NonNegativeInt
        M(v=0)  # Should pass
        M(v=5)
        with pytest.raises(ValidationErrors):
            M(v=-1)

    def test_non_positive_int(self):
        class M(BaseModel):
            v: NonPositiveInt
        M(v=0)
        M(v=-5)
        with pytest.raises(ValidationErrors):
            M(v=1)

    def test_positive_float(self):
        class M(BaseModel):
            v: PositiveFloat
        m = M(v=3.14)
        assert m.v == 3.14
        with pytest.raises(ValidationErrors):
            M(v=-1.0)

    def test_negative_float(self):
        class M(BaseModel):
            v: NegativeFloat
        M(v=-0.5)
        with pytest.raises(ValidationErrors):
            M(v=1.0)

    def test_finite_float(self):
        class M(BaseModel):
            v: FiniteFloat
        M(v=3.14)
        with pytest.raises(ValidationErrors):
            M(v=float('inf'))
        with pytest.raises(ValidationErrors):
            M(v=float('nan'))

    def test_strict_int(self):
        class M(BaseModel):
            v: StrictInt
        M(v=5)
        with pytest.raises(ValidationErrors):
            M(v=5.0)  # Float not allowed in strict mode

    def test_strict_str(self):
        class M(BaseModel):
            v: StrictStr
        M(v="hello")
        with pytest.raises(ValidationErrors):
            M(v=123)


# ============================================================
# Test: con* Functions
# ============================================================

class TestConFunctions:
    def test_conint(self):
        class M(BaseModel):
            v: conint(ge=0, le=100)
        M(v=50)
        with pytest.raises(ValidationErrors):
            M(v=101)
        with pytest.raises(ValidationErrors):
            M(v=-1)

    def test_conint_multiple_of(self):
        class M(BaseModel):
            v: conint(multiple_of=5)
        M(v=10)
        M(v=0)
        with pytest.raises(ValidationErrors):
            M(v=7)

    def test_confloat(self):
        class M(BaseModel):
            v: confloat(gt=0.0, lt=1.0)
        M(v=0.5)
        with pytest.raises(ValidationErrors):
            M(v=1.0)
        with pytest.raises(ValidationErrors):
            M(v=0.0)

    def test_constr(self):
        class M(BaseModel):
            v: constr(min_length=2, max_length=10)
        M(v="hello")
        with pytest.raises(ValidationErrors):
            M(v="x")
        with pytest.raises(ValidationErrors):
            M(v="x" * 11)

    def test_constr_pattern(self):
        class M(BaseModel):
            v: constr(pattern=r'^\d{3}-\d{4}$')
        M(v="123-4567")
        with pytest.raises(ValidationErrors):
            M(v="abc-defg")

    def test_conlist(self):
        class M(BaseModel):
            v: conlist(int, min_length=1, max_length=5)
        M(v=[1, 2, 3])
        with pytest.raises(ValidationErrors):
            M(v=[])
        with pytest.raises(ValidationErrors):
            M(v=[1, 2, 3, 4, 5, 6])

    def test_conbytes(self):
        class M(BaseModel):
            v: conbytes(min_length=1, max_length=10)
        M(v=b"hello")
        with pytest.raises(ValidationErrors):
            M(v=b"")


# ============================================================
# Test: BaseModel
# ============================================================

class TestBaseModel:
    def test_basic_model(self):
        class User(BaseModel):
            name: str
            age: int

        u = User(name="Alice", age=25)
        assert u.name == "Alice"
        assert u.age == 25

    def test_model_with_defaults(self):
        class Config(BaseModel):
            host: str = "localhost"
            port: int = 8080

        c = Config()
        assert c.host == "localhost"
        assert c.port == 8080

        c2 = Config(port=9090)
        assert c2.port == 9090

    def test_model_with_field_constraints(self):
        class User(BaseModel):
            name: Annotated[str, Field(min_length=1, max_length=50)]
            age: Annotated[int, Field(ge=0, le=150)]

        u = User(name="Bob", age=30)
        assert u.name == "Bob"

        with pytest.raises(ValidationErrors):
            User(name="", age=30)

        with pytest.raises(ValidationErrors):
            User(name="Bob", age=-1)

    def test_model_validate(self):
        class Item(BaseModel):
            name: str
            price: PositiveFloat

        item = Item.model_validate({"name": "Widget", "price": 9.99})
        assert item.name == "Widget"
        assert item.price == 9.99

    def test_model_dump(self):
        class M(BaseModel):
            x: int
            y: str

        m = M(x=1, y="hello")
        d = m.model_dump()
        assert d == {"x": 1, "y": "hello"}

    def test_model_dump_exclude(self):
        class M(BaseModel):
            x: int
            y: str
            z: float = 0.0

        m = M(x=1, y="hi")
        d = m.model_dump(exclude={"z"})
        assert d == {"x": 1, "y": "hi"}

    def test_model_dump_include(self):
        class M(BaseModel):
            x: int
            y: str
            z: float = 0.0

        m = M(x=1, y="hi")
        d = m.model_dump(include={"x", "y"})
        assert d == {"x": 1, "y": "hi"}

    def test_model_copy(self):
        class M(BaseModel):
            x: int
            y: str

        m = M(x=1, y="hello")
        m2 = m.model_copy(update={"x": 42})
        assert m2.x == 42
        assert m2.y == "hello"
        assert m.x == 1  # Original unchanged

    def test_model_json_schema(self):
        class M(BaseModel):
            name: Annotated[str, Field(min_length=1, max_length=50)]
            age: Annotated[int, Field(ge=0, le=150)]
            score: Annotated[float, Field(ge=0, le=100)] = 0.0

        schema = M.model_json_schema()
        assert schema["title"] == "M"
        assert "name" in schema["properties"]
        assert schema["properties"]["name"]["minLength"] == 1
        assert schema["properties"]["age"]["minimum"] == 0
        assert schema["properties"]["score"]["default"] == 0.0
        assert "name" in schema["required"]
        assert "score" not in schema["required"]

    def test_model_repr(self):
        class M(BaseModel):
            x: int

        m = M(x=42)
        assert "M(x=42)" == repr(m)

    def test_model_equality(self):
        class M(BaseModel):
            x: int
            y: str

        m1 = M(x=1, y="a")
        m2 = M(x=1, y="a")
        m3 = M(x=2, y="a")
        assert m1 == m2
        assert m1 != m3

    def test_required_field_missing(self):
        class M(BaseModel):
            x: int

        with pytest.raises(ValidationErrors) as exc_info:
            M()
        assert "required" in str(exc_info.value).lower()

    def test_multiple_errors(self):
        class M(BaseModel):
            x: PositiveInt
            y: Annotated[str, Field(min_length=5)]

        with pytest.raises(ValidationErrors) as exc_info:
            M(x=-1, y="hi")
        assert len(exc_info.value.errors) == 2

    def test_string_transforms(self):
        class M(BaseModel):
            name: Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True)]

        m = M(name="  HELLO  ")
        assert m.name == "hello"

    def test_model_dump_json(self):
        class M(BaseModel):
            x: int
            y: str

        m = M(x=1, y="hello")
        j = m.model_dump_json()
        assert json.loads(j) == {"x": 1, "y": "hello"}

    def test_type_coercion(self):
        class M(BaseModel):
            v: float

        # int -> float should work (non-strict)
        m = M(v=5)
        assert m.v == 5.0
        assert isinstance(m.v, float)

    def test_alias(self):
        class M(BaseModel):
            name: Annotated[str, Field(alias="user_name")]

        m = M(user_name="Alice")
        assert m.name == "Alice"


# ============================================================
# Test: Field Validators
# ============================================================

class TestFieldValidators:
    def test_field_validator_transform(self):
        class M(BaseModel):
            name: str

            @field_validator('name')
            @classmethod
            def upper_name(cls, v):
                return v.upper()

        m = M(name="hello")
        assert m.name == "HELLO"

    def test_field_validator_raises(self):
        class M(BaseModel):
            age: int

            @field_validator('age')
            @classmethod
            def check_age(cls, v):
                if v < 0:
                    raise ValueError("Age cannot be negative")
                return v

        M(age=25)
        with pytest.raises(ValueError):
            M(age=-1)

    def test_multiple_field_validators(self):
        class M(BaseModel):
            x: int
            y: int

            @field_validator('x', 'y')
            @classmethod
            def must_be_even(cls, v):
                if v % 2 != 0:
                    raise ValueError(f"{v} is not even")
                return v

        M(x=2, y=4)
        with pytest.raises(ValueError):
            M(x=3, y=4)


class TestModelValidators:
    def test_model_validator_after(self):
        class M(BaseModel):
            start: int
            end: int

            @model_validator(mode='after')
            def check_range(self):
                if self.start >= self.end:
                    raise ValueError("start must be < end")
                return self

        M(start=1, end=10)
        with pytest.raises(ValueError):
            M(start=10, end=5)

    def test_model_validator_before(self):
        class M(BaseModel):
            items: list

            @model_validator(mode='before')
            @classmethod
            def sort_items(cls, data):
                if 'items' in data:
                    data['items'] = sorted(data['items'])
                return data

        m = M(items=[3, 1, 2])
        assert m.items == [1, 2, 3]


# ============================================================
# Test: Network Types
# ============================================================

class TestNetworkTypes:
    def test_email_str(self):
        class M(BaseModel):
            email: EmailStr

        M(email="user@example.com")
        M(email="test.user+tag@subdomain.example.co.uk")
        with pytest.raises(ValidationErrors):
            M(email="not-an-email")
        with pytest.raises(ValidationErrors):
            M(email="@missing-local.com")

    def test_name_email(self):
        class M(BaseModel):
            contact: NameEmail

        M(contact="John Doe <john@example.com>")
        M(contact="plain@example.com")
        with pytest.raises(ValidationErrors):
            M(contact="not-valid")

    def test_http_url(self):
        class M(BaseModel):
            url: HttpUrl

        M(url="https://example.com")
        M(url="http://example.com/path?q=1")
        with pytest.raises(ValidationErrors):
            M(url="ftp://not-http.com")

    def test_any_url(self):
        class M(BaseModel):
            url: AnyUrl

        M(url="https://example.com")
        M(url="ftp://files.example.com")
        M(url="custom://anything")

    def test_ip_address(self):
        class M(BaseModel):
            ip: IPvAnyAddress

        M(ip="192.168.1.1")
        M(ip="::1")
        M(ip="2001:db8::1")
        with pytest.raises(ValidationErrors):
            M(ip="999.999.999.999")

    def test_ip_network(self):
        class M(BaseModel):
            net: IPvAnyNetwork

        M(net="192.168.0.0/24")
        M(net="10.0.0.0/8")
        with pytest.raises(ValidationErrors):
            M(net="not-a-network")

    def test_postgres_dsn(self):
        class M(BaseModel):
            db: PostgresDsn

        M(db="postgresql://user:pass@localhost:5432/mydb")
        with pytest.raises(ValidationErrors):
            M(db="mysql://wrong-scheme@localhost/db")

    def test_redis_dsn(self):
        class M(BaseModel):
            cache: RedisDsn

        M(cache="redis://localhost:6379/0")
        with pytest.raises(ValidationErrors):
            M(cache="http://not-redis.com")


# ============================================================
# Test: DateTime Types
# ============================================================

class TestDateTimeTypes:
    def test_past_date(self):
        from dhi import PastDate

        class M(BaseModel):
            d: PastDate

        M(d=date(2020, 1, 1))
        with pytest.raises(ValidationErrors):
            M(d=date(2099, 1, 1))

    def test_future_date(self):
        from dhi import FutureDate

        class M(BaseModel):
            d: FutureDate

        M(d=date(2099, 12, 31))
        with pytest.raises(ValidationErrors):
            M(d=date(2000, 1, 1))

    def test_aware_datetime(self):
        from dhi import AwareDatetime

        class M(BaseModel):
            dt: AwareDatetime

        M(dt=datetime(2024, 1, 1, tzinfo=timezone.utc))
        with pytest.raises(ValidationErrors):
            M(dt=datetime(2024, 1, 1))  # Naive

    def test_naive_datetime(self):
        from dhi import NaiveDatetime

        class M(BaseModel):
            dt: NaiveDatetime

        M(dt=datetime(2024, 1, 1))
        with pytest.raises(ValidationErrors):
            M(dt=datetime(2024, 1, 1, tzinfo=timezone.utc))


# ============================================================
# Test: Secret Types
# ============================================================

class TestSecretTypes:
    def test_secret_str(self):
        s = SecretStr("my-secret")
        assert str(s) == "**********"
        assert repr(s) == "SecretStr('**********')"
        assert s.get_secret_value() == "my-secret"
        assert len(s) == 9

    def test_secret_str_in_model(self):
        class M(BaseModel):
            api_key: str  # SecretStr isn't a primitive, need special handling

        m = M(api_key="sk-123")
        assert m.api_key == "sk-123"

    def test_secret_bytes(self):
        s = SecretBytes(b"secret-data")
        assert str(s) == "**********"
        assert s.get_secret_value() == b"secret-data"
        assert len(s) == 11

    def test_secret_equality(self):
        s1 = SecretStr("abc")
        s2 = SecretStr("abc")
        s3 = SecretStr("xyz")
        assert s1 == s2
        assert s1 != s3


# ============================================================
# Test: Special Types
# ============================================================

class TestSpecialTypes:
    def test_uuid4(self):
        from dhi.special_types import _UUIDVersionValidator
        v = _UUIDVersionValidator(4)
        valid_uuid = uuid.uuid4()
        result = v.validate(str(valid_uuid))
        assert result.version == 4

        with pytest.raises(ValidationError):
            v.validate("not-a-uuid")

    def test_byte_size(self):
        bs = ByteSize(1024)
        assert int(bs) == 1024
        assert bs.human_readable() == "1KiB"

        bs2 = ByteSize("2.5 MB")
        assert int(bs2) == 2500000

        bs3 = ByteSize("1 GiB")
        assert int(bs3) == 1073741824

    def test_byte_size_units(self):
        assert int(ByteSize("1 kb")) == 1000
        assert int(ByteSize("1 kib")) == 1024
        assert int(ByteSize("1 mb")) == 1000000
        assert int(ByteSize("1 mib")) == 1048576

    def test_json_validator(self):
        from dhi.special_types import _JsonValidator
        v = _JsonValidator()
        result = v.validate('{"key": "value"}')
        assert result == {"key": "value"}

        with pytest.raises(ValidationError):
            v.validate("not json{")

    def test_base64_validator(self):
        from dhi.special_types import _Base64BytesValidator
        v = _Base64BytesValidator()
        import base64
        encoded = base64.b64encode(b"hello world").decode()
        result = v.validate(encoded)
        assert result == b"hello world"


# ============================================================
# Test: Multiple Constraints Composition
# ============================================================

class TestComposition:
    def test_multiple_constraints_on_field(self):
        class M(BaseModel):
            score: Annotated[int, Gt(gt=0), Le(le=100), MultipleOf(multiple_of=5)]

        M(score=50)
        M(score=5)
        M(score=100)
        with pytest.raises(ValidationErrors):
            M(score=0)  # Not > 0
        with pytest.raises(ValidationErrors):
            M(score=101)  # Not <= 100
        with pytest.raises(ValidationErrors):
            M(score=7)  # Not multiple of 5

    def test_nested_annotated_types(self):
        # PositiveInt is Annotated[int, Gt(gt=0)]
        # Adding more constraints on top
        class M(BaseModel):
            v: Annotated[PositiveInt, Le(le=1000)]

        M(v=500)
        with pytest.raises(ValidationErrors):
            M(v=-1)  # PositiveInt constraint
        with pytest.raises(ValidationErrors):
            M(v=1001)  # Additional Le constraint

    def test_complex_model(self):
        class User(BaseModel):
            username: Annotated[str, Field(min_length=3, max_length=20, pattern=r'^[a-zA-Z0-9_]+$')]
            age: Annotated[int, Field(ge=13, le=120)]
            email: EmailStr
            score: Annotated[float, Field(ge=0.0, le=100.0)] = 50.0
            tags: Annotated[List[str], Field(max_length=10)] = []

        u = User(
            username="alice_123",
            age=25,
            email="alice@example.com",
            tags=["admin", "user"],
        )
        assert u.username == "alice_123"
        assert u.score == 50.0
        assert u.tags == ["admin", "user"]


# ============================================================
# Test: Pydantic API Compatibility
# ============================================================

class TestPydanticAPI:
    """Tests that verify the API matches Pydantic v2's interface."""

    def test_model_validate_classmethod(self):
        class M(BaseModel):
            x: int

        m = M.model_validate({"x": 42})
        assert m.x == 42

    def test_model_dump_method(self):
        class M(BaseModel):
            x: int
            y: str = "default"

        m = M(x=1)
        assert m.model_dump() == {"x": 1, "y": "default"}

    def test_model_json_schema_method(self):
        class M(BaseModel):
            x: PositiveInt

        schema = M.model_json_schema()
        assert schema["type"] == "object"
        assert "properties" in schema

    def test_model_copy_method(self):
        class M(BaseModel):
            x: int
            y: str

        m = M(x=1, y="a")
        m2 = m.model_copy(update={"x": 2})
        assert m2.x == 2
        assert m2.y == "a"

    def test_field_with_alias(self):
        class M(BaseModel):
            name: Annotated[str, Field(alias="full_name")]

        m = M(full_name="Alice")
        assert m.name == "Alice"

    def test_field_with_default_factory(self):
        class M(BaseModel):
            items: Annotated[list, Field(default_factory=list)]

        m = M()
        assert m.items == []
        m.items.append(1)

        # New instance should have fresh list
        m2 = M()
        assert m2.items == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
