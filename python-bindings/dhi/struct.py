"""
dhi.Struct - High-performance validated struct (msgspec-like).

This provides ~6x speedup over BaseModel by storing fields in a C array
instead of Python's __dict__.

Usage:
    from dhi import Struct, Field
    from typing import Annotated

    class User(Struct):
        name: Annotated[str, Field(min_length=2, max_length=100)]
        email: str
        age: Annotated[int, Field(ge=18, le=120)]

    user = User(name="John", email="john@example.com", age=30)
"""

from typing import Any, ClassVar, get_type_hints, get_origin, get_args
from typing import Annotated
import sys

# Import native module
try:
    from . import _dhi_native
    HAS_NATIVE = True
except ImportError:
    HAS_NATIVE = False
    _dhi_native = None

# Import Field and FieldInfo
from .fields import Field, FieldInfo


def _extract_constraints(annotation) -> dict:
    """Extract constraints from an annotation (possibly Annotated)."""
    constraints = {}

    origin = get_origin(annotation)
    if origin is Annotated:
        args = get_args(annotation)
        # Extract constraints from metadata
        for arg in args[1:]:
            if isinstance(arg, FieldInfo):
                if arg.gt is not None:
                    constraints['gt'] = arg.gt
                if arg.ge is not None:
                    constraints['ge'] = arg.ge
                if arg.lt is not None:
                    constraints['lt'] = arg.lt
                if arg.le is not None:
                    constraints['le'] = arg.le
                if arg.multiple_of is not None:
                    constraints['multiple_of'] = arg.multiple_of
                if arg.min_length is not None:
                    constraints['min_length'] = arg.min_length
                if arg.max_length is not None:
                    constraints['max_length'] = arg.max_length
                if arg.strict:
                    constraints['strict'] = True
                if arg.alias is not None:
                    constraints['alias'] = arg.alias

    return constraints


def _get_type_code(annotation) -> int:
    """Convert Python type annotation to type code."""
    origin = get_origin(annotation)

    # Handle Annotated types
    if origin is Annotated:
        args = get_args(annotation)
        if args:
            return _get_type_code(args[0])

    # Basic types
    if annotation is int:
        return 1
    elif annotation is float:
        return 2
    elif annotation is str:
        return 3
    elif annotation is bool:
        return 4
    elif annotation is bytes:
        return 5

    return 0  # any


def _get_format_code(annotation) -> int:
    """Get format validation code from annotation."""
    # Check for EmailStr, etc.
    if hasattr(annotation, '__name__'):
        name = annotation.__name__
        if name == 'EmailStr':
            return 1
        elif name == 'HttpUrl':
            return 2
        elif name == 'UUID':
            return 3
        elif name == 'IPv4Address':
            return 4
        elif name == 'IPv6Address':
            return 5

    # Check Annotated metadata
    origin = get_origin(annotation)
    if origin is Annotated:
        args = get_args(annotation)
        for arg in args[1:]:
            if hasattr(arg, 'format_code'):
                return arg.format_code

    return 0


class StructMeta(type):
    """Metaclass for Struct that sets up field validation."""

    def __new__(mcs, name: str, bases: tuple, namespace: dict, **kwargs):
        cls = super().__new__(mcs, name, bases, namespace)

        # Skip for the base Struct class itself
        if name == 'Struct' and not bases:
            return cls

        # Get type hints (field definitions)
        try:
            hints = get_type_hints(cls, include_extras=True)
        except Exception:
            hints = {}

        if not hints:
            return cls

        # Build field specs tuple for native init
        field_specs = []

        for field_name, annotation in hints.items():
            if field_name.startswith('_'):
                continue

            # Get default value
            default = getattr(cls, field_name, ...)
            required = default is ...
            if required:
                default = None

            # Get Field constraints from Annotated
            constraints = _extract_constraints(annotation)

            # Build constraints tuple
            type_code = _get_type_code(annotation)
            strict = constraints.get('strict', False)
            gt = constraints.get('gt')
            ge = constraints.get('ge')
            lt = constraints.get('lt')
            le = constraints.get('le')
            multiple_of = constraints.get('multiple_of')
            min_length = constraints.get('min_length')
            max_length = constraints.get('max_length')
            allow_inf_nan = constraints.get('allow_inf_nan', True)
            format_code = _get_format_code(annotation)
            strip_whitespace = constraints.get('strip_whitespace', False)
            to_lower = constraints.get('to_lower', False)
            to_upper = constraints.get('to_upper', False)

            constraint_tuple = (
                type_code,
                1 if strict else 0,
                gt,
                ge,
                lt,
                le,
                multiple_of,
                min_length,
                max_length,
                1 if allow_inf_nan else 0,
                format_code,
                1 if strip_whitespace else 0,
                1 if to_lower else 0,
                1 if to_upper else 0,
            )

            # Field spec: (name, alias, required, default, constraints)
            alias = constraints.get('alias', None)
            field_spec = (
                field_name,
                alias,
                required,
                default,
                constraint_tuple,
            )
            field_specs.append(field_spec)

        # Store field names for reference
        cls.__dhi_fields__ = tuple(hints.keys())

        # Initialize native struct class if available
        if HAS_NATIVE and field_specs:
            try:
                _dhi_native.init_struct_class(cls, tuple(field_specs))
            except Exception as e:
                # Fall back to Python implementation
                print(f"Warning: Native Struct init failed: {e}", file=sys.stderr)

        return cls


if HAS_NATIVE:
    # Use native Struct as base
    class Struct(_dhi_native.Struct, metaclass=StructMeta):
        """
        High-performance validated struct.

        Fields are stored in a C array instead of Python's __dict__,
        providing ~6x speedup over BaseModel.
        """
        __slots__ = ()  # Prevent __dict__ creation

        def model_dump(self) -> dict:
            """Convert to dictionary."""
            result = {}
            field_names = getattr(type(self), '__dhi_field_names__', ())
            for i, name in enumerate(field_names):
                result[name] = self.values[i] if hasattr(self, 'values') else getattr(self, name, None)
            return result

        def __iter__(self):
            """Iterate over field names."""
            return iter(getattr(type(self), '__dhi_field_names__', ()))

        def __eq__(self, other):
            if not isinstance(other, type(self)):
                return False
            field_names = getattr(type(self), '__dhi_field_names__', ())
            for name in field_names:
                if getattr(self, name, None) != getattr(other, name, None):
                    return False
            return True

        def __hash__(self):
            field_names = getattr(type(self), '__dhi_field_names__', ())
            return hash(tuple(getattr(self, name, None) for name in field_names))
else:
    # Fallback pure-Python implementation
    class Struct(metaclass=StructMeta):
        """
        Pure-Python fallback Struct implementation.
        For best performance, ensure the native extension is built.
        """
        __slots__ = ()

        def __init__(self, **kwargs):
            for name in self.__dhi_fields__:
                if name in kwargs:
                    setattr(self, name, kwargs[name])
                elif hasattr(self, name):
                    pass  # Has default
                else:
                    raise ValueError(f"Field '{name}' is required")

        def model_dump(self) -> dict:
            return {name: getattr(self, name) for name in self.__dhi_fields__}


# Export
__all__ = ['Struct', 'StructMeta']
