"""
Pydantic v2 compatible type aliases for dhi.

Provides all the standard Pydantic constrained types as Annotated aliases:
- Strict types (StrictInt, StrictStr, etc.)
- Positive/Negative number types
- FiniteFloat
- con* factory functions (conint, confloat, constr, etc.)

Example:
    from dhi import PositiveInt, StrictStr, conint

    class User(BaseModel):
        age: PositiveInt
        name: StrictStr
        score: conint(ge=0, le=100)
"""

from typing import Annotated, Any, FrozenSet, List, Optional, Set, Type, Union
import sys

from .constraints import (
    Gt, Ge, Lt, Le, MultipleOf,
    MinLength, MaxLength, Pattern,
    Strict, StripWhitespace, ToLower, ToUpper,
    AllowInfNan, MaxDigits, DecimalPlaces, UniqueItems,
    StringConstraints,
)


# ============================================================
# Strict Types - No type coercion allowed
# ============================================================

StrictInt = Annotated[int, Strict()]
StrictFloat = Annotated[float, Strict()]
StrictStr = Annotated[str, Strict()]
StrictBool = Annotated[bool, Strict()]
StrictBytes = Annotated[bytes, Strict()]


# ============================================================
# Positive/Negative Integer Types
# ============================================================

PositiveInt = Annotated[int, Gt(gt=0)]
NegativeInt = Annotated[int, Lt(lt=0)]
NonNegativeInt = Annotated[int, Ge(ge=0)]
NonPositiveInt = Annotated[int, Le(le=0)]


# ============================================================
# Positive/Negative Float Types
# ============================================================

PositiveFloat = Annotated[float, Gt(gt=0)]
NegativeFloat = Annotated[float, Lt(lt=0)]
NonNegativeFloat = Annotated[float, Ge(ge=0)]
NonPositiveFloat = Annotated[float, Le(le=0)]
FiniteFloat = Annotated[float, AllowInfNan(allow_inf_nan=False)]


# ============================================================
# con* Factory Functions - Create constrained Annotated types
# ============================================================

def conint(
    *,
    gt: Optional[int] = None,
    ge: Optional[int] = None,
    lt: Optional[int] = None,
    le: Optional[int] = None,
    multiple_of: Optional[int] = None,
    strict: Optional[bool] = None,
) -> Any:
    """Create a constrained integer type.

    Matches Pydantic's conint() function.

    Example:
        Score = conint(ge=0, le=100)

        class Model(BaseModel):
            score: Score
    """
    constraints = []
    if strict:
        constraints.append(Strict())
    if gt is not None:
        constraints.append(Gt(gt=gt))
    if ge is not None:
        constraints.append(Ge(ge=ge))
    if lt is not None:
        constraints.append(Lt(lt=lt))
    if le is not None:
        constraints.append(Le(le=le))
    if multiple_of is not None:
        constraints.append(MultipleOf(multiple_of=multiple_of))
    if not constraints:
        return int
    return Annotated[tuple([int] + constraints)]


def confloat(
    *,
    gt: Optional[float] = None,
    ge: Optional[float] = None,
    lt: Optional[float] = None,
    le: Optional[float] = None,
    multiple_of: Optional[float] = None,
    allow_inf_nan: Optional[bool] = None,
    strict: Optional[bool] = None,
) -> Any:
    """Create a constrained float type.

    Matches Pydantic's confloat() function.

    Example:
        Probability = confloat(ge=0.0, le=1.0)
    """
    constraints = []
    if strict:
        constraints.append(Strict())
    if gt is not None:
        constraints.append(Gt(gt=gt))
    if ge is not None:
        constraints.append(Ge(ge=ge))
    if lt is not None:
        constraints.append(Lt(lt=lt))
    if le is not None:
        constraints.append(Le(le=le))
    if multiple_of is not None:
        constraints.append(MultipleOf(multiple_of=multiple_of))
    if allow_inf_nan is not None:
        constraints.append(AllowInfNan(allow_inf_nan=allow_inf_nan))
    if not constraints:
        return float
    return Annotated[tuple([float] + constraints)]


def constr(
    *,
    min_length: Optional[int] = None,
    max_length: Optional[int] = None,
    pattern: Optional[str] = None,
    strip_whitespace: bool = False,
    to_lower: bool = False,
    to_upper: bool = False,
    strict: Optional[bool] = None,
) -> Any:
    """Create a constrained string type.

    Matches Pydantic's constr() function.

    Example:
        Username = constr(min_length=3, max_length=20, to_lower=True)
    """
    constraints = []
    if strict:
        constraints.append(Strict())
    if min_length is not None:
        constraints.append(MinLength(min_length=min_length))
    if max_length is not None:
        constraints.append(MaxLength(max_length=max_length))
    if pattern is not None:
        constraints.append(Pattern(pattern=pattern))
    if strip_whitespace:
        constraints.append(StripWhitespace())
    if to_lower:
        constraints.append(ToLower())
    if to_upper:
        constraints.append(ToUpper())
    if not constraints:
        return str
    return Annotated[tuple([str] + constraints)]


def conbytes(
    *,
    min_length: Optional[int] = None,
    max_length: Optional[int] = None,
    strict: Optional[bool] = None,
) -> Any:
    """Create a constrained bytes type.

    Matches Pydantic's conbytes() function.
    """
    constraints = []
    if strict:
        constraints.append(Strict())
    if min_length is not None:
        constraints.append(MinLength(min_length=min_length))
    if max_length is not None:
        constraints.append(MaxLength(max_length=max_length))
    if not constraints:
        return bytes
    return Annotated[tuple([bytes] + constraints)]


def conlist(
    item_type: Type = Any,
    *,
    min_length: Optional[int] = None,
    max_length: Optional[int] = None,
    unique_items: Optional[bool] = None,
) -> Any:
    """Create a constrained list type.

    Matches Pydantic's conlist() function.

    Example:
        Tags = conlist(str, min_length=1, max_length=10)
    """
    constraints = []
    if min_length is not None:
        constraints.append(MinLength(min_length=min_length))
    if max_length is not None:
        constraints.append(MaxLength(max_length=max_length))
    if unique_items:
        constraints.append(UniqueItems())
    base_type = List[item_type]
    if not constraints:
        return base_type
    return Annotated[tuple([base_type] + constraints)]


def conset(
    item_type: Type = Any,
    *,
    min_length: Optional[int] = None,
    max_length: Optional[int] = None,
) -> Any:
    """Create a constrained set type.

    Matches Pydantic's conset() function.
    """
    constraints = []
    if min_length is not None:
        constraints.append(MinLength(min_length=min_length))
    if max_length is not None:
        constraints.append(MaxLength(max_length=max_length))
    base_type = Set[item_type]
    if not constraints:
        return base_type
    return Annotated[tuple([base_type] + constraints)]


def confrozenset(
    item_type: Type = Any,
    *,
    min_length: Optional[int] = None,
    max_length: Optional[int] = None,
) -> Any:
    """Create a constrained frozenset type.

    Matches Pydantic's confrozenset() function.
    """
    constraints = []
    if min_length is not None:
        constraints.append(MinLength(min_length=min_length))
    if max_length is not None:
        constraints.append(MaxLength(max_length=max_length))
    base_type = FrozenSet[item_type]
    if not constraints:
        return base_type
    return Annotated[tuple([base_type] + constraints)]


def condecimal(
    *,
    gt: Optional[Any] = None,
    ge: Optional[Any] = None,
    lt: Optional[Any] = None,
    le: Optional[Any] = None,
    multiple_of: Optional[Any] = None,
    max_digits: Optional[int] = None,
    decimal_places: Optional[int] = None,
    allow_inf_nan: Optional[bool] = None,
) -> Any:
    """Create a constrained Decimal type.

    Matches Pydantic's condecimal() function.
    """
    from decimal import Decimal
    constraints = []
    if gt is not None:
        constraints.append(Gt(gt=gt))
    if ge is not None:
        constraints.append(Ge(ge=ge))
    if lt is not None:
        constraints.append(Lt(lt=lt))
    if le is not None:
        constraints.append(Le(le=le))
    if multiple_of is not None:
        constraints.append(MultipleOf(multiple_of=multiple_of))
    if max_digits is not None:
        constraints.append(MaxDigits(max_digits=max_digits))
    if decimal_places is not None:
        constraints.append(DecimalPlaces(decimal_places=decimal_places))
    if allow_inf_nan is not None:
        constraints.append(AllowInfNan(allow_inf_nan=allow_inf_nan))
    if not constraints:
        return Decimal
    return Annotated[tuple([Decimal] + constraints)]


def condate(
    *,
    gt: Optional[Any] = None,
    ge: Optional[Any] = None,
    lt: Optional[Any] = None,
    le: Optional[Any] = None,
) -> Any:
    """Create a constrained date type.

    Matches Pydantic's condate() function.
    """
    from datetime import date
    constraints = []
    if gt is not None:
        constraints.append(Gt(gt=gt))
    if ge is not None:
        constraints.append(Ge(ge=ge))
    if lt is not None:
        constraints.append(Lt(lt=lt))
    if le is not None:
        constraints.append(Le(le=le))
    if not constraints:
        return date
    return Annotated[tuple([date] + constraints)]


__all__ = [
    # Strict types
    "StrictInt", "StrictFloat", "StrictStr", "StrictBool", "StrictBytes",
    # Positive/Negative integers
    "PositiveInt", "NegativeInt", "NonNegativeInt", "NonPositiveInt",
    # Positive/Negative floats
    "PositiveFloat", "NegativeFloat", "NonNegativeFloat", "NonPositiveFloat",
    "FiniteFloat",
    # con* functions
    "conint", "confloat", "constr", "conbytes",
    "conlist", "conset", "confrozenset",
    "condecimal", "condate",
]
