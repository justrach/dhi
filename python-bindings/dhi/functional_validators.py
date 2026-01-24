"""
Functional validators for dhi - Pydantic v2 compatible.

Provides decorator-based validators that can be applied to BaseModel fields
and models, matching Pydantic's @field_validator and @model_validator.

Example:
    from dhi import BaseModel, field_validator, model_validator

    class User(BaseModel):
        name: str
        password: str
        confirm_password: str

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
"""

from typing import Any, Callable, Optional, Sequence, Union


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


__all__ = ["field_validator", "model_validator", "validator"]
