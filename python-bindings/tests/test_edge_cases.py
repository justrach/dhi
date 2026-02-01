"""
Edge case verification tests for dhi Pydantic parity.

These tests verify behavior at boundary conditions and with unusual inputs
to ensure dhi matches Pydantic v2 behavior exactly.
"""

import sys
import math
from typing import Annotated, Optional, List, Union
from decimal import Decimal

import pytest

import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from dhi import (
    BaseModel, Field, ValidationErrors,
    Gt, Ge, Lt, Le, MultipleOf,
    MinLength, MaxLength,
    StrictInt, StrictFloat, StrictStr, StrictBool,
    PositiveInt, NegativeInt, NonNegativeInt, NonPositiveInt,
    PositiveFloat, NegativeFloat, FiniteFloat,
    conint, confloat, constr, conlist,
    StringConstraints,
    field_validator, model_validator,
    EmailStr,
)


# ============================================================
# Test: Numeric Boundary Edge Cases
# ============================================================

class TestNumericBoundaries:
    """Test exact boundary behavior for numeric constraints."""

    def test_gt_boundary_exclusive(self):
        """gt=5 should reject 5, accept 6"""
        class M(BaseModel):
            v: Annotated[int, Gt(gt=5)]

        with pytest.raises(ValidationErrors):
            M(v=5)  # Exactly at boundary - should fail
        M(v=6)  # Above boundary - should pass

    def test_ge_boundary_inclusive(self):
        """ge=5 should accept 5"""
        class M(BaseModel):
            v: Annotated[int, Ge(ge=5)]

        M(v=5)  # Exactly at boundary - should pass
        M(v=6)  # Above boundary - should pass
        with pytest.raises(ValidationErrors):
            M(v=4)  # Below boundary - should fail

    def test_lt_boundary_exclusive(self):
        """lt=10 should reject 10, accept 9"""
        class M(BaseModel):
            v: Annotated[int, Lt(lt=10)]

        with pytest.raises(ValidationErrors):
            M(v=10)  # Exactly at boundary - should fail
        M(v=9)  # Below boundary - should pass

    def test_le_boundary_inclusive(self):
        """le=10 should accept 10"""
        class M(BaseModel):
            v: Annotated[int, Le(le=10)]

        M(v=10)  # Exactly at boundary - should pass
        with pytest.raises(ValidationErrors):
            M(v=11)  # Above boundary - should fail

    def test_combined_gt_lt_boundaries(self):
        """Test gt and lt together (exclusive range)"""
        class M(BaseModel):
            v: Annotated[int, Field(gt=0, lt=10)]

        with pytest.raises(ValidationErrors):
            M(v=0)  # gt=0 means > 0, so 0 fails
        with pytest.raises(ValidationErrors):
            M(v=10)  # lt=10 means < 10, so 10 fails
        M(v=1)  # Inside range
        M(v=9)  # Inside range

    def test_combined_ge_le_boundaries(self):
        """Test ge and le together (inclusive range)"""
        class M(BaseModel):
            v: Annotated[int, Field(ge=0, le=10)]

        M(v=0)  # ge=0 includes 0
        M(v=10)  # le=10 includes 10
        M(v=5)  # Inside range

    def test_zero_boundary(self):
        """Special handling of zero"""
        class MPos(BaseModel):
            v: PositiveInt  # gt=0

        class MNonNeg(BaseModel):
            v: NonNegativeInt  # ge=0

        with pytest.raises(ValidationErrors):
            MPos(v=0)  # PositiveInt rejects 0
        MNonNeg(v=0)  # NonNegativeInt accepts 0


class TestNumericSpecialValues:
    """Test special numeric values like infinity, NaN, large numbers."""

    def test_float_infinity_positive(self):
        """Test positive infinity handling"""
        class M(BaseModel):
            v: float

        m = M(v=float('inf'))
        assert m.v == float('inf')
        assert math.isinf(m.v)

    def test_float_infinity_negative(self):
        """Test negative infinity handling"""
        class M(BaseModel):
            v: float

        m = M(v=float('-inf'))
        assert m.v == float('-inf')

    def test_float_nan(self):
        """Test NaN handling"""
        class M(BaseModel):
            v: float

        m = M(v=float('nan'))
        assert math.isnan(m.v)

    def test_finite_float_rejects_infinity(self):
        """FiniteFloat should reject infinity"""
        class M(BaseModel):
            v: FiniteFloat

        with pytest.raises(ValidationErrors):
            M(v=float('inf'))
        with pytest.raises(ValidationErrors):
            M(v=float('-inf'))

    def test_finite_float_rejects_nan(self):
        """FiniteFloat should reject NaN"""
        class M(BaseModel):
            v: FiniteFloat

        with pytest.raises(ValidationErrors):
            M(v=float('nan'))

    def test_large_integer(self):
        """Test large integers within C long range"""
        class M(BaseModel):
            v: int

        # dhi uses C long internally, so very large Python ints may overflow
        # Test with values that fit in a 64-bit signed int
        large = 2**62  # Within i64 range
        m = M(v=large)
        assert m.v == large

    def test_sys_maxsize(self):
        """Test sys.maxsize (largest C long)"""
        class M(BaseModel):
            v: int

        m = M(v=sys.maxsize)
        assert m.v == sys.maxsize

        m2 = M(v=-sys.maxsize - 1)  # Minimum
        assert m2.v == -sys.maxsize - 1

    def test_negative_zero_float(self):
        """Test -0.0 handling"""
        class M(BaseModel):
            v: float

        m = M(v=-0.0)
        assert m.v == 0.0  # -0.0 == 0.0 in Python

    def test_float_precision(self):
        """Test float precision edge case"""
        class M(BaseModel):
            v: Annotated[float, Field(ge=0.3)]

        # 0.1 + 0.2 = 0.30000000000000004 in float
        M(v=0.1 + 0.2)  # Should pass (it's > 0.3)


class TestMultipleOf:
    """Test multiple_of constraint edge cases."""

    def test_multiple_of_zero(self):
        """multiple_of=0 should be rejected or handled"""
        # This is likely an error condition
        with pytest.raises((ValueError, ZeroDivisionError, ValidationErrors)):
            class M(BaseModel):
                v: Annotated[int, MultipleOf(multiple_of=0)]
            M(v=5)

    def test_multiple_of_one(self):
        """multiple_of=1 - all integers pass"""
        class M(BaseModel):
            v: Annotated[int, MultipleOf(multiple_of=1)]

        M(v=0)
        M(v=1)
        M(v=-1)
        M(v=12345)

    def test_multiple_of_negative(self):
        """multiple_of with negative divisor"""
        class M(BaseModel):
            v: Annotated[int, MultipleOf(multiple_of=-5)]

        M(v=10)  # 10 % -5 == 0
        M(v=-10)
        M(v=0)

    def test_multiple_of_float(self):
        """multiple_of with float values"""
        class M(BaseModel):
            v: Annotated[float, Field(multiple_of=0.5)]

        M(v=1.0)
        M(v=1.5)
        M(v=2.0)
        with pytest.raises(ValidationErrors):
            M(v=1.3)


# ============================================================
# Test: String Edge Cases
# ============================================================

class TestStringEdgeCases:
    """Test string handling edge cases."""

    def test_empty_string(self):
        """Empty string handling"""
        class M(BaseModel):
            v: str

        m = M(v="")
        assert m.v == ""

    def test_empty_string_min_length_zero(self):
        """min_length=0 allows empty string"""
        class M(BaseModel):
            v: Annotated[str, Field(min_length=0)]

        M(v="")

    def test_empty_string_min_length_one(self):
        """min_length=1 rejects empty string"""
        class M(BaseModel):
            v: Annotated[str, Field(min_length=1)]

        with pytest.raises(ValidationErrors):
            M(v="")

    def test_unicode_emoji(self):
        """Unicode emoji characters"""
        class M(BaseModel):
            v: str

        m = M(v="Hello 👋 World 🌍")
        assert m.v == "Hello 👋 World 🌍"

    def test_unicode_length_counting(self):
        """Length should count characters, not bytes"""
        class M(BaseModel):
            v: Annotated[str, Field(max_length=5)]

        # "Hello" is 5 chars
        M(v="Hello")

        # "你好世界！" is 5 chars (but many bytes)
        M(v="你好世界！")

        with pytest.raises(ValidationErrors):
            M(v="你好世界！！")  # 6 chars

    def test_unicode_multibyte(self):
        """Multi-byte Unicode characters"""
        class M(BaseModel):
            v: Annotated[str, Field(min_length=2, max_length=4)]

        M(v="日本")  # 2 Japanese chars
        M(v="🎉🎊🎈")  # 3 emoji
        with pytest.raises(ValidationErrors):
            M(v="あ")  # 1 char - too short

    def test_whitespace_only(self):
        """Whitespace-only strings"""
        class M(BaseModel):
            v: str

        M(v="   ")  # Just spaces
        M(v="\t\n")  # Tabs and newlines

    def test_strip_whitespace(self):
        """strip_whitespace should remove leading/trailing whitespace"""
        class M(BaseModel):
            v: Annotated[str, StringConstraints(strip_whitespace=True)]

        m = M(v="  hello  ")
        assert m.v == "hello"

    def test_strip_whitespace_with_min_length(self):
        """strip_whitespace happens before length check"""
        class M(BaseModel):
            v: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5)]

        M(v="  hello  ")  # After strip: "hello" (5 chars) - passes
        with pytest.raises(ValidationErrors):
            M(v="  hi  ")  # After strip: "hi" (2 chars) - fails

    def test_null_character(self):
        """Strings with embedded null characters"""
        class M(BaseModel):
            v: str

        m = M(v="hello\x00world")
        assert m.v == "hello\x00world"
        assert len(m.v) == 11

    def test_very_long_string(self):
        """Very long strings"""
        class M(BaseModel):
            v: str

        long_str = "x" * 10000
        m = M(v=long_str)
        assert len(m.v) == 10000


# ============================================================
# Test: Type Coercion Edge Cases
# ============================================================

class TestTypeCoercion:
    """Test type coercion behavior."""

    def test_bool_not_coerced_to_int_strict(self):
        """StrictInt should reject bool (even though bool is subclass of int)"""
        class M(BaseModel):
            v: StrictInt

        with pytest.raises(ValidationErrors):
            M(v=True)
        with pytest.raises(ValidationErrors):
            M(v=False)

    def test_int_to_float_coercion(self):
        """int should coerce to float in non-strict mode"""
        class M(BaseModel):
            v: float

        m = M(v=5)
        assert m.v == 5.0
        assert isinstance(m.v, float)

    def test_float_to_int_coercion(self):
        """dhi allows float→int coercion for convenience (unlike strict Pydantic v2)"""
        class M(BaseModel):
            v: int

        # dhi coerces float to int (truncates)
        m = M(v=5.5)
        assert m.v == 5
        assert isinstance(m.v, int)

    def test_float_whole_number_to_int(self):
        """float that is a whole number (5.0) coerces to int"""
        class M(BaseModel):
            v: int

        # dhi coerces float to int
        m = M(v=5.0)
        assert m.v == 5
        assert isinstance(m.v, int)

    def test_str_not_coerced_to_int(self):
        """str should not coerce to int"""
        class M(BaseModel):
            v: int

        with pytest.raises(ValidationErrors):
            M(v="123")

    def test_none_for_required_field(self):
        """None should fail for required non-optional field"""
        class M(BaseModel):
            v: int

        with pytest.raises(ValidationErrors):
            M(v=None)

    def test_none_for_optional_field(self):
        """None should pass for Optional field"""
        class M(BaseModel):
            v: Optional[int] = None

        m = M(v=None)
        assert m.v is None

        m2 = M()
        assert m2.v is None

    def test_subclass_handling(self):
        """Subclasses of expected types"""
        class MyInt(int):
            pass

        class M(BaseModel):
            v: int

        m = M(v=MyInt(5))
        assert m.v == 5


# ============================================================
# Test: Collection Edge Cases
# ============================================================

class TestCollectionEdgeCases:
    """Test list, set, and other collection edge cases."""

    def test_empty_list(self):
        """Empty list handling"""
        class M(BaseModel):
            v: List[int]

        m = M(v=[])
        assert m.v == []

    def test_empty_list_min_length(self):
        """min_length=1 rejects empty list"""
        class M(BaseModel):
            v: conlist(int, min_length=1)

        with pytest.raises(ValidationErrors):
            M(v=[])
        M(v=[1])

    def test_nested_list(self):
        """Nested lists"""
        class M(BaseModel):
            v: List[List[int]]

        m = M(v=[[1, 2], [3, 4]])
        assert m.v == [[1, 2], [3, 4]]

    def test_list_with_none(self):
        """List containing None"""
        class M(BaseModel):
            v: List[Optional[int]]

        m = M(v=[1, None, 3])
        assert m.v == [1, None, 3]

    def test_list_type_validation(self):
        """List item type validation"""
        class M(BaseModel):
            v: List[int]

        with pytest.raises(ValidationErrors):
            M(v=[1, "two", 3])


# ============================================================
# Test: Model Edge Cases
# ============================================================

class TestModelEdgeCases:
    """Test BaseModel edge cases."""

    def test_model_inheritance(self):
        """Model inheritance"""
        class Base(BaseModel):
            x: int

        class Child(Base):
            y: str

        c = Child(x=1, y="hello")
        assert c.x == 1
        assert c.y == "hello"

    def test_model_inheritance_override_field(self):
        """Child model can add constraints to inherited field"""
        class Base(BaseModel):
            x: int

        class Child(Base):
            x: PositiveInt  # More restrictive
            y: str

        c = Child(x=5, y="hello")
        assert c.x == 5

        with pytest.raises(ValidationErrors):
            Child(x=-1, y="hello")

    def test_nested_model(self):
        """Nested models"""
        class Inner(BaseModel):
            value: int

        class Outer(BaseModel):
            inner: Inner

        o = Outer(inner={"value": 42})
        assert o.inner.value == 42

    def test_nested_model_validation(self):
        """Nested model validation errors"""
        class Inner(BaseModel):
            value: PositiveInt

        class Outer(BaseModel):
            inner: Inner

        with pytest.raises(ValidationErrors):
            Outer(inner={"value": -1})

    def test_optional_nested_model(self):
        """Optional nested model"""
        class Inner(BaseModel):
            value: int

        class Outer(BaseModel):
            inner: Optional[Inner] = None

        o1 = Outer()
        assert o1.inner is None

        o2 = Outer(inner={"value": 1})
        assert o2.inner.value == 1

    def test_extra_fields_ignored_by_default(self):
        """Extra fields should be ignored by default"""
        class M(BaseModel):
            x: int

        m = M(x=1, y=2, z=3)  # y, z are extra
        assert m.x == 1
        assert not hasattr(m, 'y')

    def test_model_with_no_fields(self):
        """Model with no fields"""
        class Empty(BaseModel):
            pass

        e = Empty()
        assert e.model_dump() == {}

    def test_all_optional_model(self):
        """Model where all fields are optional"""
        class M(BaseModel):
            x: int = 0
            y: str = ""

        m = M()
        assert m.x == 0
        assert m.y == ""


class TestUnionTypes:
    """Test Union type handling."""

    def test_union_int_str(self):
        """Union[int, str]"""
        class M(BaseModel):
            v: Union[int, str]

        m1 = M(v=42)
        assert m1.v == 42

        m2 = M(v="hello")
        assert m2.v == "hello"

    def test_union_first_match_wins(self):
        """Union should try types in order"""
        class M(BaseModel):
            v: Union[int, str]

        # String "123" should NOT become int
        # (because we try int first and it should fail)
        m = M(v="123")
        assert m.v == "123"
        assert isinstance(m.v, str)

    def test_optional_is_union_with_none(self):
        """Optional[T] is Union[T, None]"""
        class M(BaseModel):
            v: Optional[int]

        m1 = M(v=42)
        assert m1.v == 42

        m2 = M(v=None)
        assert m2.v is None


# ============================================================
# Test: Validator Edge Cases
# ============================================================

class TestValidatorEdgeCases:
    """Test field_validator and model_validator edge cases."""

    def test_field_validator_return_none(self):
        """Field validator returning None"""
        class M(BaseModel):
            v: Optional[str]

            @field_validator('v')
            @classmethod
            def maybe_none(cls, v):
                if v == "none":
                    return None
                return v

        m = M(v="none")
        assert m.v is None

    def test_field_validator_modify_type(self):
        """Field validator changing type"""
        class M(BaseModel):
            v: str

            @field_validator('v')
            @classmethod
            def to_string(cls, v):
                return str(v).upper()

        m = M(v="hello")
        assert m.v == "HELLO"

    def test_model_validator_access_all_fields(self):
        """Model validator can access all fields"""
        class M(BaseModel):
            a: int
            b: int

            @model_validator(mode='after')
            def check_sum(self):
                if self.a + self.b > 100:
                    raise ValueError("Sum too large")
                return self

        M(a=50, b=40)
        with pytest.raises(ValueError):
            M(a=60, b=50)


# ============================================================
# Test: Error Handling Edge Cases
# ============================================================

class TestErrorHandling:
    """Test error handling and reporting."""

    def test_multiple_validation_errors(self):
        """Multiple fields failing validation"""
        class M(BaseModel):
            x: PositiveInt
            y: Annotated[str, Field(min_length=5)]
            z: Annotated[float, Field(ge=0)]

        with pytest.raises(ValidationErrors) as exc_info:
            M(x=-1, y="hi", z=-1.0)

        errors = exc_info.value.errors
        assert len(errors) == 3

    def test_nested_error_path(self):
        """Error path for nested model"""
        class Inner(BaseModel):
            value: PositiveInt

        class Outer(BaseModel):
            inner: Inner

        with pytest.raises(ValidationErrors) as exc_info:
            Outer(inner={"value": -1})

        # Should have error for inner.value
        errors = exc_info.value.errors
        assert len(errors) >= 1

    def test_error_on_missing_required(self):
        """Error message for missing required field"""
        class M(BaseModel):
            required_field: int

        with pytest.raises(ValidationErrors) as exc_info:
            M()

        assert "required" in str(exc_info.value).lower()


# ============================================================
# Test: Email Validation Edge Cases
# ============================================================

class TestEmailEdgeCases:
    """Test EmailStr validation edge cases."""

    def test_email_simple(self):
        """Simple valid email"""
        class M(BaseModel):
            email: EmailStr

        M(email="user@example.com")

    def test_email_with_plus(self):
        """Email with + tag"""
        class M(BaseModel):
            email: EmailStr

        M(email="user+tag@example.com")

    def test_email_subdomain(self):
        """Email with subdomain"""
        class M(BaseModel):
            email: EmailStr

        M(email="user@mail.example.com")

    def test_email_no_tld(self):
        """Email without TLD should fail"""
        class M(BaseModel):
            email: EmailStr

        with pytest.raises(ValidationErrors):
            M(email="user@localhost")  # No TLD

    def test_email_no_at(self):
        """Email without @ should fail"""
        class M(BaseModel):
            email: EmailStr

        with pytest.raises(ValidationErrors):
            M(email="userexample.com")

    def test_email_empty_local(self):
        """Email with empty local part should fail"""
        class M(BaseModel):
            email: EmailStr

        with pytest.raises(ValidationErrors):
            M(email="@example.com")

    def test_email_empty_domain(self):
        """Email with empty domain should fail"""
        class M(BaseModel):
            email: EmailStr

        with pytest.raises(ValidationErrors):
            M(email="user@")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
