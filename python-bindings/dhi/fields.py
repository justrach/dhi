"""
Field definition for dhi - Pydantic v2 compatible.

Provides the Field() function for defining field-level constraints
and metadata, matching Pydantic's API.

Example:
    from typing import Annotated
    from dhi import BaseModel, Field

    class User(BaseModel):
        name: Annotated[str, Field(min_length=1, max_length=100)]
        age: Annotated[int, Field(gt=0, le=120)]
"""

from typing import Any, Optional, Union, List

_MISSING = object()  # Sentinel for unset defaults


class FieldInfo:
    """Stores field constraints and metadata.

    This is the object returned by Field() and can be used in Annotated types.
    Pydantic v2 compatible.
    """
    __slots__ = (
        'default', 'default_factory', 'alias', 'validation_alias',
        'serialization_alias', 'title', 'description', 'examples',
        'gt', 'ge', 'lt', 'le', 'multiple_of', 'strict',
        'min_length', 'max_length', 'pattern', 'strip_whitespace',
        'to_lower', 'to_upper', 'allow_inf_nan', 'max_digits',
        'decimal_places', 'unique_items', 'exclude', 'include',
        'discriminator', 'json_schema_extra', 'frozen', 'validate_default',
        'repr', 'init', 'init_var', 'kw_only', 'annotation',
    )

    def __init__(
        self,
        default: Any = _MISSING,
        *,
        default_factory: Any = None,
        alias: Optional[str] = None,
        validation_alias: Optional[str] = None,
        serialization_alias: Optional[str] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        examples: Optional[List[Any]] = None,
        gt: Optional[Union[int, float]] = None,
        ge: Optional[Union[int, float]] = None,
        lt: Optional[Union[int, float]] = None,
        le: Optional[Union[int, float]] = None,
        multiple_of: Optional[Union[int, float]] = None,
        strict: Optional[bool] = None,
        min_length: Optional[int] = None,
        max_length: Optional[int] = None,
        pattern: Optional[str] = None,
        strip_whitespace: Optional[bool] = None,
        to_lower: Optional[bool] = None,
        to_upper: Optional[bool] = None,
        allow_inf_nan: Optional[bool] = None,
        max_digits: Optional[int] = None,
        decimal_places: Optional[int] = None,
        unique_items: Optional[bool] = None,
        exclude: Optional[bool] = None,
        include: Optional[bool] = None,
        discriminator: Optional[str] = None,
        json_schema_extra: Optional[Any] = None,
        frozen: Optional[bool] = None,
        validate_default: Optional[bool] = None,
        repr: Optional[bool] = True,
        init: Optional[bool] = None,
        init_var: Optional[bool] = None,
        kw_only: Optional[bool] = None,
        annotation: Optional[Any] = None,
    ):
        self.default = default
        self.default_factory = default_factory
        self.alias = alias
        self.validation_alias = validation_alias
        self.serialization_alias = serialization_alias
        self.title = title
        self.description = description
        self.examples = examples
        self.gt = gt
        self.ge = ge
        self.lt = lt
        self.le = le
        self.multiple_of = multiple_of
        self.strict = strict
        self.min_length = min_length
        self.max_length = max_length
        self.pattern = pattern
        self.strip_whitespace = strip_whitespace
        self.to_lower = to_lower
        self.to_upper = to_upper
        self.allow_inf_nan = allow_inf_nan
        self.max_digits = max_digits
        self.decimal_places = decimal_places
        self.unique_items = unique_items
        self.exclude = exclude
        self.include = include
        self.discriminator = discriminator
        self.json_schema_extra = json_schema_extra
        self.frozen = frozen
        self.validate_default = validate_default
        self.repr = repr
        self.init = init
        self.init_var = init_var
        self.kw_only = kw_only
        self.annotation = annotation

    @property
    def is_required(self) -> bool:
        return self.default is _MISSING and self.default_factory is None

    def get_default(self) -> Any:
        if self.default_factory is not None:
            return self.default_factory()
        if self.default is _MISSING:
            raise ValueError("Field is required")
        return self.default

    def __repr__(self) -> str:
        parts = []
        if self.default is not _MISSING:
            parts.append(f"default={self.default!r}")
        if self.gt is not None:
            parts.append(f"gt={self.gt}")
        if self.ge is not None:
            parts.append(f"ge={self.ge}")
        if self.lt is not None:
            parts.append(f"lt={self.lt}")
        if self.le is not None:
            parts.append(f"le={self.le}")
        if self.multiple_of is not None:
            parts.append(f"multiple_of={self.multiple_of}")
        if self.min_length is not None:
            parts.append(f"min_length={self.min_length}")
        if self.max_length is not None:
            parts.append(f"max_length={self.max_length}")
        if self.pattern is not None:
            parts.append(f"pattern={self.pattern!r}")
        if self.strict:
            parts.append("strict=True")
        return f"FieldInfo({', '.join(parts)})"


def Field(
    default: Any = _MISSING,
    *,
    default_factory: Any = None,
    alias: Optional[str] = None,
    validation_alias: Optional[str] = None,
    serialization_alias: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    examples: Optional[List[Any]] = None,
    gt: Optional[Union[int, float]] = None,
    ge: Optional[Union[int, float]] = None,
    lt: Optional[Union[int, float]] = None,
    le: Optional[Union[int, float]] = None,
    multiple_of: Optional[Union[int, float]] = None,
    strict: Optional[bool] = None,
    min_length: Optional[int] = None,
    max_length: Optional[int] = None,
    pattern: Optional[str] = None,
    strip_whitespace: Optional[bool] = None,
    to_lower: Optional[bool] = None,
    to_upper: Optional[bool] = None,
    allow_inf_nan: Optional[bool] = None,
    max_digits: Optional[int] = None,
    decimal_places: Optional[int] = None,
    unique_items: Optional[bool] = None,
    exclude: Optional[bool] = None,
    include: Optional[bool] = None,
    discriminator: Optional[str] = None,
    json_schema_extra: Optional[Any] = None,
    frozen: Optional[bool] = None,
    validate_default: Optional[bool] = None,
    repr: Optional[bool] = True,
    init: Optional[bool] = None,
    init_var: Optional[bool] = None,
    kw_only: Optional[bool] = None,
) -> FieldInfo:
    """Create a FieldInfo with constraints and metadata.

    Matches Pydantic v2's Field() function signature exactly.

    Args:
        default: Default value for the field.
        default_factory: Callable to generate default value.
        alias: Alias for validation and serialization.
        validation_alias: Alias used only during validation.
        serialization_alias: Alias used only during serialization.
        title: Human-readable title for JSON schema.
        description: Human-readable description for JSON schema.
        examples: Example values for JSON schema.
        gt: Value must be greater than this.
        ge: Value must be greater than or equal to this.
        lt: Value must be less than this.
        le: Value must be less than or equal to this.
        multiple_of: Value must be a multiple of this.
        strict: If True, no type coercion is performed.
        min_length: Minimum length for strings/collections.
        max_length: Maximum length for strings/collections.
        pattern: Regex pattern for string validation.
        strip_whitespace: Strip leading/trailing whitespace from strings.
        to_lower: Convert string to lowercase.
        to_upper: Convert string to uppercase.
        allow_inf_nan: Allow infinity and NaN for floats.
        max_digits: Maximum digits for Decimal.
        decimal_places: Maximum decimal places for Decimal.
        unique_items: Require unique items in list.
        exclude: Exclude field from serialization.
        include: Include field in serialization (deprecated).
        discriminator: Field name for tagged union discrimination.
        json_schema_extra: Extra properties for JSON schema.
        frozen: If True, field is immutable after creation.
        validate_default: If True, validate default value.
        repr: If True, include field in __repr__.
        init: If True, include in __init__ (dataclass compat).
        init_var: If True, init-only variable (dataclass compat).
        kw_only: If True, keyword-only argument (dataclass compat).

    Example:
        from typing import Annotated
        from dhi import Field

        # Numeric constraints
        age: Annotated[int, Field(gt=0, le=120)]

        # String constraints with alias
        name: Annotated[str, Field(min_length=1, alias='userName')]

        # Frozen field
        id: Annotated[str, Field(frozen=True)]
    """
    return FieldInfo(
        default=default,
        default_factory=default_factory,
        alias=alias,
        validation_alias=validation_alias,
        serialization_alias=serialization_alias,
        title=title,
        description=description,
        examples=examples,
        gt=gt,
        ge=ge,
        lt=lt,
        le=le,
        multiple_of=multiple_of,
        strict=strict,
        min_length=min_length,
        max_length=max_length,
        pattern=pattern,
        strip_whitespace=strip_whitespace,
        to_lower=to_lower,
        to_upper=to_upper,
        allow_inf_nan=allow_inf_nan,
        max_digits=max_digits,
        decimal_places=decimal_places,
        unique_items=unique_items,
        exclude=exclude,
        include=include,
        discriminator=discriminator,
        json_schema_extra=json_schema_extra,
        frozen=frozen,
        validate_default=validate_default,
        repr=repr,
        init=init,
        init_var=init_var,
        kw_only=kw_only,
    )


__all__ = ["Field", "FieldInfo"]
