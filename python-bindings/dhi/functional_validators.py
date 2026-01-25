"""
Functional validators for dhi - Pydantic v2 compatible.

Provides decorator-based validators that can be applied to BaseModel fields
and models, matching Pydantic's @field_validator and @model_validator.

Also provides:
- @computed_field: Define computed properties included in serialization
- PrivateAttr: Define private attributes not included in validation

Example:
    from dhi import BaseModel, field_validator, model_validator, computed_field, PrivateAttr

    class User(BaseModel):
        name: str
        password: str
        confirm_password: str
        _login_count: int = PrivateAttr(default=0)

        @field_validator('name')
        @classmethod
        def name_must_be_alpha(cls, v):
            if not v.isalpha():
                raise ValueError('Name must be alphabetic')
            return v

        @model_validator(mode='after')
        def passwords_match(self):
            if self.password != self.confirm_password:
                raise ValueError('Passwords do not match')
            return self

        @computed_field
        @property
        def display_name(self) -> str:
            return self.name.title()
"""

from typing import Any, Callable, Optional, Sequence, Type, Union


def field_validator(
    *fields: str,
    mode: str = 'after',
) -> Callable:
    """Decorator for field-level custom validation.

    Matches Pydantic v2's @field_validator decorator.

    Args:
        *fields: Field names this validator applies to.
        mode: 'before' for pre-validation, 'after' for post-validation.

    Example:
        class Model(BaseModel):
            name: str

            @field_validator('name')
            @classmethod
            def validate_name(cls, v):
                if len(v) < 2:
                    raise ValueError('Name too short')
                return v.title()
    """
    def decorator(func: Callable) -> Callable:
        func.__validator_fields__ = fields
        func.__validator_mode__ = mode
        return func
    return decorator


def model_validator(
    *,
    mode: str = 'after',
) -> Callable:
    """Decorator for model-level custom validation.

    Matches Pydantic v2's @model_validator decorator.

    Args:
        mode: 'before' runs before field validation (receives raw data dict),
              'after' runs after field validation (receives model instance).

    Example:
        class Model(BaseModel):
            start: int
            end: int

            @model_validator(mode='after')
            def check_order(self):
                if self.start >= self.end:
                    raise ValueError('start must be less than end')
                return self
    """
    def decorator(func: Callable) -> Callable:
        func.__model_validator__ = True
        func.__validator_mode__ = mode
        return func
    return decorator


def validator(
    *fields: str,
    pre: bool = False,
    always: bool = False,
) -> Callable:
    """Legacy Pydantic v1 style validator (for backward compatibility).

    Prefer @field_validator for new code.
    """
    def decorator(func: Callable) -> Callable:
        func.__validator_fields__ = fields
        func.__validator_mode__ = 'before' if pre else 'after'
        return func
    return decorator


class PrivateAttr:
    """Define a private attribute on a BaseModel.

    Private attributes are:
    - Not included in validation
    - Not included in serialization (model_dump)
    - Not included in JSON schema
    - Prefixed with underscore by convention

    Matches Pydantic v2's PrivateAttr exactly.

    Example:
        class User(BaseModel):
            name: str
            _secret: str = PrivateAttr(default='hidden')
            _counter: int = PrivateAttr(default_factory=int)
    """

    __slots__ = ('default', 'default_factory')

    def __init__(
        self,
        default: Any = ...,
        *,
        default_factory: Optional[Callable[[], Any]] = None,
    ):
        if default is not ... and default_factory is not None:
            raise ValueError('Cannot specify both default and default_factory')
        self.default = default
        self.default_factory = default_factory

    def get_default(self) -> Any:
        """Get the default value for this private attribute."""
        if self.default_factory is not None:
            return self.default_factory()
        if self.default is ...:
            raise ValueError('No default value specified')
        return self.default

    def __repr__(self) -> str:
        if self.default_factory is not None:
            return f'PrivateAttr(default_factory={self.default_factory})'
        if self.default is ...:
            return 'PrivateAttr()'
        return f'PrivateAttr(default={self.default!r})'


class ComputedFieldInfo:
    """Metadata for a computed field.

    Stores information about a computed (property-based) field.
    """

    __slots__ = ('wrapped_property', 'return_type', 'alias', 'title',
                 'description', 'repr', 'json_schema_extra')

    def __init__(
        self,
        wrapped_property: property,
        return_type: Any = None,
        alias: Optional[str] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        repr: bool = True,
        json_schema_extra: Optional[Any] = None,
    ):
        self.wrapped_property = wrapped_property
        self.return_type = return_type
        self.alias = alias
        self.title = title
        self.description = description
        self.repr = repr
        self.json_schema_extra = json_schema_extra

    def __repr__(self) -> str:
        return f'ComputedFieldInfo(alias={self.alias!r})'


def computed_field(
    func: Optional[Callable] = None,
    *,
    alias: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    repr: bool = True,
    return_type: Any = None,
    json_schema_extra: Optional[Any] = None,
) -> Any:
    """Decorator to define a computed field on a BaseModel.

    Computed fields are read-only properties that are included in
    serialization (model_dump) but not in validation.

    Matches Pydantic v2's @computed_field decorator.

    Args:
        alias: Alias name for serialization.
        title: Title for JSON schema.
        description: Description for JSON schema.
        repr: Include in __repr__ output.
        return_type: Override the return type annotation.
        json_schema_extra: Extra JSON schema properties.

    Example:
        class Rectangle(BaseModel):
            width: float
            height: float

            @computed_field
            @property
            def area(self) -> float:
                return self.width * self.height

        rect = Rectangle(width=3, height=4)
        assert rect.area == 12.0
        assert rect.model_dump() == {'width': 3.0, 'height': 4.0, 'area': 12.0}
    """
    def decorator(prop: Any) -> ComputedFieldInfo:
        if isinstance(prop, property):
            wrapped = prop
        elif callable(prop):
            # Allow @computed_field without @property
            wrapped = property(prop)
        else:
            raise TypeError(
                '@computed_field should be used with a property or callable'
            )

        # Extract return type from annotations if not provided
        ret_type = return_type
        if ret_type is None and hasattr(prop, 'fget') and prop.fget is not None:
            annotations = getattr(prop.fget, '__annotations__', {})
            ret_type = annotations.get('return')

        return ComputedFieldInfo(
            wrapped_property=wrapped,
            return_type=ret_type,
            alias=alias,
            title=title,
            description=description,
            repr=repr,
            json_schema_extra=json_schema_extra,
        )

    if func is not None:
        return decorator(func)
    return decorator


__all__ = [
    "field_validator",
    "model_validator",
    "validator",
    "PrivateAttr",
    "ComputedFieldInfo",
    "computed_field",
]
