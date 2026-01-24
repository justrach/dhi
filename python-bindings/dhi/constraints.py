"""
Constraint metadata classes for dhi - Pydantic v2 compatible.

These classes are used with typing.Annotated to define validation constraints
on fields, matching the annotated_types / Pydantic v2 pattern.

Example:
    from typing import Annotated
    from dhi import Gt, Le, MinLength

    age: Annotated[int, Gt(gt=0), Le(le=120)]
    name: Annotated[str, MinLength(min_length=1)]
"""

from typing import Optional, Union

# Use slots for performance on Python 3.10+, fall back gracefully
import sys
_DATACLASS_KWARGS = {"frozen": True}
if sys.version_info >= (3, 10):
    _DATACLASS_KWARGS["slots"] = True


# --- Numeric Constraints ---

class Gt:
    """Greater than constraint."""
    __slots__ = ('gt',)

    def __init__(self, gt: Union[int, float]):
        object.__setattr__(self, 'gt', gt)

    def __repr__(self) -> str:
        return f"Gt(gt={self.gt!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Gt) and self.gt == other.gt

    def __hash__(self) -> int:
        return hash(('Gt', self.gt))


class Ge:
    """Greater than or equal constraint."""
    __slots__ = ('ge',)

    def __init__(self, ge: Union[int, float]):
        object.__setattr__(self, 'ge', ge)

    def __repr__(self) -> str:
        return f"Ge(ge={self.ge!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Ge) and self.ge == other.ge

    def __hash__(self) -> int:
        return hash(('Ge', self.ge))


class Lt:
    """Less than constraint."""
    __slots__ = ('lt',)

    def __init__(self, lt: Union[int, float]):
        object.__setattr__(self, 'lt', lt)

    def __repr__(self) -> str:
        return f"Lt(lt={self.lt!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Lt) and self.lt == other.lt

    def __hash__(self) -> int:
        return hash(('Lt', self.lt))


class Le:
    """Less than or equal constraint."""
    __slots__ = ('le',)

    def __init__(self, le: Union[int, float]):
        object.__setattr__(self, 'le', le)

    def __repr__(self) -> str:
        return f"Le(le={self.le!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Le) and self.le == other.le

    def __hash__(self) -> int:
        return hash(('Le', self.le))


class MultipleOf:
    """Multiple of constraint."""
    __slots__ = ('multiple_of',)

    def __init__(self, multiple_of: Union[int, float]):
        object.__setattr__(self, 'multiple_of', multiple_of)

    def __repr__(self) -> str:
        return f"MultipleOf(multiple_of={self.multiple_of!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, MultipleOf) and self.multiple_of == other.multiple_of

    def __hash__(self) -> int:
        return hash(('MultipleOf', self.multiple_of))


# --- String Constraints ---

class MinLength:
    """Minimum length constraint (for strings, bytes, collections)."""
    __slots__ = ('min_length',)

    def __init__(self, min_length: int):
        object.__setattr__(self, 'min_length', min_length)

    def __repr__(self) -> str:
        return f"MinLength(min_length={self.min_length!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, MinLength) and self.min_length == other.min_length

    def __hash__(self) -> int:
        return hash(('MinLength', self.min_length))


class MaxLength:
    """Maximum length constraint (for strings, bytes, collections)."""
    __slots__ = ('max_length',)

    def __init__(self, max_length: int):
        object.__setattr__(self, 'max_length', max_length)

    def __repr__(self) -> str:
        return f"MaxLength(max_length={self.max_length!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, MaxLength) and self.max_length == other.max_length

    def __hash__(self) -> int:
        return hash(('MaxLength', self.max_length))


class Pattern:
    """Regex pattern constraint for strings."""
    __slots__ = ('pattern',)

    def __init__(self, pattern: str):
        object.__setattr__(self, 'pattern', pattern)

    def __repr__(self) -> str:
        return f"Pattern(pattern={self.pattern!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Pattern) and self.pattern == other.pattern

    def __hash__(self) -> int:
        return hash(('Pattern', self.pattern))


class Strict:
    """Strict type checking - no coercion allowed."""
    __slots__ = ('strict',)

    def __init__(self, strict: bool = True):
        object.__setattr__(self, 'strict', strict)

    def __repr__(self) -> str:
        return f"Strict(strict={self.strict!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Strict) and self.strict == other.strict

    def __hash__(self) -> int:
        return hash(('Strict', self.strict))


class StripWhitespace:
    """Strip leading/trailing whitespace from strings."""
    __slots__ = ('strip_whitespace',)

    def __init__(self, strip_whitespace: bool = True):
        object.__setattr__(self, 'strip_whitespace', strip_whitespace)

    def __repr__(self) -> str:
        return f"StripWhitespace(strip_whitespace={self.strip_whitespace!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, StripWhitespace) and self.strip_whitespace == other.strip_whitespace

    def __hash__(self) -> int:
        return hash(('StripWhitespace', self.strip_whitespace))


class ToLower:
    """Convert string to lowercase."""
    __slots__ = ('to_lower',)

    def __init__(self, to_lower: bool = True):
        object.__setattr__(self, 'to_lower', to_lower)

    def __repr__(self) -> str:
        return f"ToLower(to_lower={self.to_lower!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, ToLower) and self.to_lower == other.to_lower

    def __hash__(self) -> int:
        return hash(('ToLower', self.to_lower))


class ToUpper:
    """Convert string to uppercase."""
    __slots__ = ('to_upper',)

    def __init__(self, to_upper: bool = True):
        object.__setattr__(self, 'to_upper', to_upper)

    def __repr__(self) -> str:
        return f"ToUpper(to_upper={self.to_upper!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, ToUpper) and self.to_upper == other.to_upper

    def __hash__(self) -> int:
        return hash(('ToUpper', self.to_upper))


class AllowInfNan:
    """Control whether inf/nan float values are allowed."""
    __slots__ = ('allow_inf_nan',)

    def __init__(self, allow_inf_nan: bool = True):
        object.__setattr__(self, 'allow_inf_nan', allow_inf_nan)

    def __repr__(self) -> str:
        return f"AllowInfNan(allow_inf_nan={self.allow_inf_nan!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, AllowInfNan) and self.allow_inf_nan == other.allow_inf_nan

    def __hash__(self) -> int:
        return hash(('AllowInfNan', self.allow_inf_nan))


class MaxDigits:
    """Maximum total digits for Decimal types."""
    __slots__ = ('max_digits',)

    def __init__(self, max_digits: int):
        object.__setattr__(self, 'max_digits', max_digits)

    def __repr__(self) -> str:
        return f"MaxDigits(max_digits={self.max_digits!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, MaxDigits) and self.max_digits == other.max_digits

    def __hash__(self) -> int:
        return hash(('MaxDigits', self.max_digits))


class DecimalPlaces:
    """Maximum decimal places for Decimal types."""
    __slots__ = ('decimal_places',)

    def __init__(self, decimal_places: int):
        object.__setattr__(self, 'decimal_places', decimal_places)

    def __repr__(self) -> str:
        return f"DecimalPlaces(decimal_places={self.decimal_places!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, DecimalPlaces) and self.decimal_places == other.decimal_places

    def __hash__(self) -> int:
        return hash(('DecimalPlaces', self.decimal_places))


class UniqueItems:
    """Ensure collection items are unique."""
    __slots__ = ('unique_items',)

    def __init__(self, unique_items: bool = True):
        object.__setattr__(self, 'unique_items', unique_items)

    def __repr__(self) -> str:
        return f"UniqueItems(unique_items={self.unique_items!r})"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, UniqueItems) and self.unique_items == other.unique_items

    def __hash__(self) -> int:
        return hash(('UniqueItems', self.unique_items))


# --- Compound Constraint Classes (Pydantic v2 style) ---

class StringConstraints:
    """Combined string constraints - matches Pydantic v2's StringConstraints.

    Example:
        from typing import Annotated
        from dhi import StringConstraints

        Username = Annotated[str, StringConstraints(min_length=3, max_length=20, to_lower=True)]
    """
    __slots__ = ('min_length', 'max_length', 'pattern', 'strip_whitespace',
                 'to_lower', 'to_upper', 'strict')

    def __init__(
        self,
        *,
        min_length: Optional[int] = None,
        max_length: Optional[int] = None,
        pattern: Optional[str] = None,
        strip_whitespace: bool = False,
        to_lower: bool = False,
        to_upper: bool = False,
        strict: bool = False,
    ):
        object.__setattr__(self, 'min_length', min_length)
        object.__setattr__(self, 'max_length', max_length)
        object.__setattr__(self, 'pattern', pattern)
        object.__setattr__(self, 'strip_whitespace', strip_whitespace)
        object.__setattr__(self, 'to_lower', to_lower)
        object.__setattr__(self, 'to_upper', to_upper)
        object.__setattr__(self, 'strict', strict)

    def __repr__(self) -> str:
        parts = []
        if self.min_length is not None:
            parts.append(f"min_length={self.min_length}")
        if self.max_length is not None:
            parts.append(f"max_length={self.max_length}")
        if self.pattern is not None:
            parts.append(f"pattern={self.pattern!r}")
        if self.strip_whitespace:
            parts.append("strip_whitespace=True")
        if self.to_lower:
            parts.append("to_lower=True")
        if self.to_upper:
            parts.append("to_upper=True")
        if self.strict:
            parts.append("strict=True")
        return f"StringConstraints({', '.join(parts)})"


__all__ = [
    "Gt", "Ge", "Lt", "Le", "MultipleOf",
    "MinLength", "MaxLength", "Pattern",
    "Strict", "StripWhitespace", "ToLower", "ToUpper",
    "AllowInfNan", "MaxDigits", "DecimalPlaces", "UniqueItems",
    "StringConstraints",
]
