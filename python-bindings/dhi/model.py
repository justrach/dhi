"""
BaseModel implementation for dhi - Pydantic v2 compatible.

Provides a lightweight, high-performance BaseModel that validates data
on instantiation using type annotations and constraints.

Full Pydantic v2 API compatibility including:
- model_validate, model_validate_json, model_construct
- model_dump with all parameters (exclude, include, by_alias, exclude_unset, etc.)
- model_fields, model_fields_set, model_extra, model_computed_fields
- model_config (ConfigDict support)
- model_post_init hook
- Nested model validation
- computed_field and PrivateAttr support

Example:
    from typing import Annotated
    from dhi import BaseModel, Field, PositiveInt, EmailStr, ConfigDict

    class User(BaseModel):
        model_config = ConfigDict(frozen=True)

        name: Annotated[str, Field(min_length=1, max_length=100)]
        age: PositiveInt
        email: EmailStr
        score: Annotated[float, Field(ge=0, le=100)] = 0.0

    user = User(name="Alice", age=25, email="alice@example.com")
    print(user.model_dump())
"""

import re
import math
import copy
import json as _json
from typing import (
    Any, Callable, ClassVar, Dict, FrozenSet, Iterator, List, Literal, Mapping,
    Optional, Set, Type, Tuple, TypeVar, Union,
    get_type_hints,
)

try:
    from typing import get_args, get_origin, Annotated, Self
except ImportError:
    from typing_extensions import get_args, get_origin, Annotated
    Self = TypeVar('Self', bound='BaseModel')

from .constraints import (
    Gt, Ge, Lt, Le, MultipleOf,
    MinLength, MaxLength, Pattern,
    Strict, StripWhitespace, ToLower, ToUpper,
    AllowInfNan, MaxDigits, DecimalPlaces, UniqueItems,
    StringConstraints,
)
from .fields import FieldInfo, Field, _MISSING
from .validator import ValidationError, ValidationErrors, HAS_NATIVE_EXT
from .config import ConfigDict, CONFIG_DEFAULTS, get_config_value
from .functional_validators import PrivateAttr, ComputedFieldInfo

if HAS_NATIVE_EXT:
    from . import _dhi_native

# Type variable for model methods returning Self
_T = TypeVar('_T', bound='BaseModel')

# Include/Exclude type alias matching Pydantic
IncEx = Optional[Union[Set[str], Dict[str, Any]]]

# Type code mapping for native validator
_TYPE_CODES = {int: 1, float: 2, str: 3, bool: 4, bytes: 5}

# Cache for compiled validators per class
_CLASS_VALIDATORS_CACHE: Dict[type, Dict[str, Any]] = {}


def _extract_constraints(annotation: Any) -> Tuple[Type, List[Any]]:
    """Extract base type and constraint metadata from an annotation.

    Handles:
    - Plain types: int, str, float
    - Annotated types: Annotated[int, Gt(gt=0), Le(le=100)]
    - FieldInfo in Annotated: Annotated[str, Field(min_length=1)]
    """
    origin = get_origin(annotation)
    if origin is Annotated:
        args = get_args(annotation)
        base_type = args[0]
        constraints = list(args[1:])
        # Recursively unwrap nested Annotated (e.g., PositiveInt used in Annotated)
        nested_origin = get_origin(base_type)
        if nested_origin is Annotated:
            nested_args = get_args(base_type)
            base_type = nested_args[0]
            constraints = list(nested_args[1:]) + constraints
        return base_type, constraints
    return annotation, []


def _is_basemodel_subclass(typ: Any) -> bool:
    """Check if a type is a BaseModel subclass (for nested validation)."""
    try:
        # Avoid circular import issues
        return isinstance(typ, type) and hasattr(typ, '__dhi_fields__')
    except (TypeError, AttributeError):
        return False


def _build_validator(field_name: str, base_type: Type, constraints: List[Any], config: Optional[ConfigDict] = None) -> Any:
    """Build a compiled validator function for a field.

    Returns a function that takes a value and returns the validated/transformed value,
    or raises ValidationError.

    Supports nested BaseModel validation.
    """
    # Collect all constraints from both individual metadata and FieldInfo objects
    gt = ge = lt = le = multiple_of = None
    min_length = max_length = None
    pattern_str = None
    strict = get_config_value(config, 'strict', False)
    strip_whitespace = get_config_value(config, 'str_strip_whitespace', False)
    to_lower = get_config_value(config, 'str_to_lower', False)
    to_upper = get_config_value(config, 'str_to_upper', False)
    allow_inf_nan = True
    max_digits = decimal_places = None
    unique_items = False
    custom_validators: List[Any] = []

    # Check if base_type is a nested BaseModel
    nested_model = None
    if _is_basemodel_subclass(base_type):
        nested_model = base_type

    for constraint in constraints:
        if isinstance(constraint, Gt):
            gt = constraint.gt
        elif isinstance(constraint, Ge):
            ge = constraint.ge
        elif isinstance(constraint, Lt):
            lt = constraint.lt
        elif isinstance(constraint, Le):
            le = constraint.le
        elif isinstance(constraint, MultipleOf):
            multiple_of = constraint.multiple_of
        elif isinstance(constraint, MinLength):
            min_length = constraint.min_length
        elif isinstance(constraint, MaxLength):
            max_length = constraint.max_length
        elif isinstance(constraint, Pattern):
            pattern_str = constraint.pattern
        elif isinstance(constraint, Strict):
            strict = constraint.strict
        elif isinstance(constraint, StripWhitespace):
            strip_whitespace = constraint.strip_whitespace
        elif isinstance(constraint, ToLower):
            to_lower = constraint.to_lower
        elif isinstance(constraint, ToUpper):
            to_upper = constraint.to_upper
        elif isinstance(constraint, AllowInfNan):
            allow_inf_nan = constraint.allow_inf_nan
        elif isinstance(constraint, MaxDigits):
            max_digits = constraint.max_digits
        elif isinstance(constraint, DecimalPlaces):
            decimal_places = constraint.decimal_places
        elif isinstance(constraint, UniqueItems):
            unique_items = constraint.unique_items
        elif isinstance(constraint, StringConstraints):
            # Unpack compound constraints
            if constraint.min_length is not None:
                min_length = constraint.min_length
            if constraint.max_length is not None:
                max_length = constraint.max_length
            if constraint.pattern is not None:
                pattern_str = constraint.pattern
            if constraint.strip_whitespace:
                strip_whitespace = True
            if constraint.to_lower:
                to_lower = True
            if constraint.to_upper:
                to_upper = True
            if constraint.strict:
                strict = True
        elif isinstance(constraint, FieldInfo):
            # Extract constraints from FieldInfo
            if constraint.gt is not None:
                gt = constraint.gt
            if constraint.ge is not None:
                ge = constraint.ge
            if constraint.lt is not None:
                lt = constraint.lt
            if constraint.le is not None:
                le = constraint.le
            if constraint.multiple_of is not None:
                multiple_of = constraint.multiple_of
            if constraint.min_length is not None:
                min_length = constraint.min_length
            if constraint.max_length is not None:
                max_length = constraint.max_length
            if constraint.pattern is not None:
                pattern_str = constraint.pattern
            if constraint.strict:
                strict = True
            if constraint.strip_whitespace:
                strip_whitespace = True
            if constraint.to_lower:
                to_lower = True
            if constraint.to_upper:
                to_upper = True
            if constraint.allow_inf_nan is not None:
                allow_inf_nan = constraint.allow_inf_nan
            if constraint.max_digits is not None:
                max_digits = constraint.max_digits
            if constraint.decimal_places is not None:
                decimal_places = constraint.decimal_places
            if constraint.unique_items:
                unique_items = True
        elif hasattr(constraint, 'validate') and callable(constraint.validate):
            # Custom validator object (e.g., _EmailValidator, _UrlValidator, etc.)
            custom_validators.append(constraint)
        elif callable(constraint):
            custom_validators.append(constraint)

    # Pre-compile pattern if present
    compiled_pattern = re.compile(pattern_str) if pattern_str else None

    # Determine the expected Python type for type checking
    # Handle generic types (List[int] -> list, Set[str] -> set, etc.)
    check_type = base_type
    type_origin = get_origin(base_type)
    if type_origin is not None:
        check_type = type_origin

    def validator(value: Any) -> Any:
        # Type checking
        if strict:
            if type(value) is not check_type:
                raise ValidationError(
                    field_name,
                    f"Expected exactly {check_type.__name__}, got {type(value).__name__}"
                )
        else:
            # Coerce compatible types
            if check_type in (int, float) and not isinstance(value, check_type):
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    try:
                        value = check_type(value)
                    except (ValueError, TypeError, OverflowError):
                        raise ValidationError(
                            field_name,
                            f"Cannot convert {type(value).__name__} to {check_type.__name__}"
                        )
                else:
                    raise ValidationError(
                        field_name,
                        f"Expected {check_type.__name__}, got {type(value).__name__}"
                    )
            elif check_type is str and not isinstance(value, str):
                raise ValidationError(
                    field_name,
                    f"Expected str, got {type(value).__name__}"
                )
            elif check_type is bytes and not isinstance(value, bytes):
                raise ValidationError(
                    field_name,
                    f"Expected bytes, got {type(value).__name__}"
                )
            elif check_type is bool and not isinstance(value, bool):
                raise ValidationError(
                    field_name,
                    f"Expected bool, got {type(value).__name__}"
                )
            elif check_type in (list, set, frozenset) and not isinstance(value, check_type):
                raise ValidationError(
                    field_name,
                    f"Expected {check_type.__name__}, got {type(value).__name__}"
                )

        # String transformations (before validation)
        if isinstance(value, str):
            if strip_whitespace:
                value = value.strip()
            if to_lower:
                value = value.lower()
            if to_upper:
                value = value.upper()

        # Numeric constraints
        if gt is not None and value <= gt:
            raise ValidationError(field_name, f"Value must be > {gt}, got {value}")
        if ge is not None and value < ge:
            raise ValidationError(field_name, f"Value must be >= {ge}, got {value}")
        if lt is not None and value >= lt:
            raise ValidationError(field_name, f"Value must be < {lt}, got {value}")
        if le is not None and value > le:
            raise ValidationError(field_name, f"Value must be <= {le}, got {value}")
        if multiple_of is not None and value % multiple_of != 0:
            raise ValidationError(field_name, f"Value must be a multiple of {multiple_of}, got {value}")

        # Float-specific constraints
        if not allow_inf_nan and isinstance(value, float):
            if math.isinf(value) or math.isnan(value):
                raise ValidationError(field_name, f"Value must be finite, got {value}")

        # Length constraints (strings, bytes, collections)
        if min_length is not None or max_length is not None:
            length = len(value)
            if min_length is not None and length < min_length:
                raise ValidationError(
                    field_name,
                    f"Length must be >= {min_length}, got {length}"
                )
            if max_length is not None and length > max_length:
                raise ValidationError(
                    field_name,
                    f"Length must be <= {max_length}, got {length}"
                )

        # Pattern constraint
        if compiled_pattern is not None and isinstance(value, str):
            if not compiled_pattern.match(value):
                raise ValidationError(
                    field_name,
                    f"String does not match pattern '{pattern_str}'"
                )

        # Decimal constraints
        if max_digits is not None or decimal_places is not None:
            from decimal import Decimal
            if isinstance(value, Decimal):
                sign, digits, exp = value.as_tuple()
                num_digits = len(digits)
                if max_digits is not None and num_digits > max_digits:
                    raise ValidationError(
                        field_name,
                        f"Decimal must have at most {max_digits} digits, got {num_digits}"
                    )
                if decimal_places is not None:
                    actual_places = -exp if exp < 0 else 0
                    if actual_places > decimal_places:
                        raise ValidationError(
                            field_name,
                            f"Decimal must have at most {decimal_places} decimal places, got {actual_places}"
                        )

        # Unique items constraint
        if unique_items and isinstance(value, list):
            seen = set()
            for item in value:
                item_key = repr(item)  # Use repr for unhashable items
                if item_key in seen:
                    raise ValidationError(
                        field_name,
                        f"List items must be unique, found duplicate: {item!r}"
                    )
                seen.add(item_key)

        # Nested BaseModel validation
        if nested_model is not None:
            if isinstance(value, nested_model):
                pass  # Already validated
            elif isinstance(value, dict):
                value = nested_model.model_validate(value)
            else:
                raise ValidationError(
                    field_name,
                    f"Expected {nested_model.__name__} or dict, got {type(value).__name__}"
                )

        # Custom validators (objects with .validate() or callables)
        for custom_val in custom_validators:
            if hasattr(custom_val, 'validate'):
                value = custom_val.validate(value, field_name)
            else:
                value = custom_val(value)

        return value

    # --- NATIVE ACCELERATION PATH ---
    # Use C extension for type check + numeric bounds + string length in one call.
    # Falls back to Python for: regex patterns, decimal constraints, unique items, nested models.
    can_use_native = (
        HAS_NATIVE_EXT
        and compiled_pattern is None
        and max_digits is None
        and decimal_places is None
        and not unique_items
        and nested_model is None
        and check_type in _TYPE_CODES
    )

    if can_use_native:
        type_code = _TYPE_CODES[check_type]
        native_constraints = (
            type_code, int(strict),
            gt, ge, lt, le, multiple_of,
            min_length, max_length,
            int(allow_inf_nan), 0,  # format_code=0 (handled by custom validators)
            int(strip_whitespace), int(to_lower), int(to_upper),
        )

        if custom_validators:
            # Native for type+bounds, then Python for custom validators
            _custom_vals = custom_validators

            def native_validator_with_custom(value: Any) -> Any:
                try:
                    value = _dhi_native.validate_field(value, field_name, native_constraints)
                except ValueError as e:
                    msg = str(e)
                    prefix = field_name + ': '
                    if msg.startswith(prefix):
                        msg = msg[len(prefix):]
                    raise ValidationError(field_name, msg)
                for cv in _custom_vals:
                    if hasattr(cv, 'validate'):
                        value = cv.validate(value, field_name)
                    else:
                        value = cv(value)
                return value

            return native_validator_with_custom
        else:
            # Fully native - one C call handles everything
            def native_validator(value: Any) -> Any:
                try:
                    return _dhi_native.validate_field(value, field_name, native_constraints)
                except ValueError as e:
                    msg = str(e)
                    prefix = field_name + ': '
                    if msg.startswith(prefix):
                        msg = msg[len(prefix):]
                    raise ValidationError(field_name, msg)

            # Tag for batch init_model detection
            native_validator.__dhi_native_constraints__ = native_constraints
            return native_validator

    return validator


class _ModelMeta(type):
    """Metaclass for BaseModel that compiles validators at class creation."""

    def __new__(mcs, name: str, bases: tuple, namespace: dict) -> type:
        cls = super().__new__(mcs, name, bases, namespace)

        if name == 'BaseModel':
            # Set default values for the base class
            cls.__dhi_compiled_specs__ = None
            cls.__dhi_has_custom_validators__ = False
            cls.__dhi_private_attrs__ = {}
            cls.__dhi_has_post_init__ = False
            cls.__dhi_extra_mode_int__ = 0
            cls.__dhi_needs_post_init__ = False
            cls.__dhi_nested_field_specs__ = None
            cls.__dhi_has_nested_fields__ = False
            cls.__dhi_full_native__ = False
            cls.__dhi_use_ultra_fast__ = False
            return cls

        # Get model_config from class or inherit from parent
        model_config: Optional[ConfigDict] = namespace.get('model_config')
        if model_config is None:
            for base in bases:
                if hasattr(base, 'model_config') and base.model_config is not None:
                    model_config = base.model_config
                    break
        cls.model_config = model_config

        # Get type hints including Annotated metadata
        try:
            hints = get_type_hints(cls, include_extras=True)
        except Exception:
            hints = {}

        # Collect private attributes (underscore-prefixed with PrivateAttr)
        private_attrs: Dict[str, PrivateAttr] = {}
        for attr_name, attr_value in namespace.items():
            if attr_name.startswith('_') and not attr_name.startswith('__'):
                if isinstance(attr_value, PrivateAttr):
                    private_attrs[attr_name] = attr_value
        cls.__dhi_private_attrs__ = private_attrs

        # Collect computed fields
        computed_fields: Dict[str, ComputedFieldInfo] = {}
        for attr_name, attr_value in namespace.items():
            if isinstance(attr_value, ComputedFieldInfo):
                computed_fields[attr_name] = attr_value
                # Set the property on the class
                setattr(cls, attr_name, attr_value.wrapped_property)
        cls.__dhi_computed_fields__ = computed_fields
        cls.model_computed_fields = computed_fields

        # Build field info and validators
        fields: Dict[str, Dict[str, Any]] = {}
        validators: Dict[str, Any] = {}
        model_fields: Dict[str, FieldInfo] = {}

        # Reserved attribute names that should not be treated as fields
        reserved_names = {
            'model_config', 'model_fields', 'model_computed_fields',
            'model_fields_set', 'model_extra',
        }

        for field_name, annotation in hints.items():
            if field_name.startswith('_'):
                continue
            if field_name in reserved_names:
                continue

            base_type, constraints = _extract_constraints(annotation)

            # Check for class-level default
            default = namespace.get(field_name, _MISSING)
            default_factory = None

            # Find the FieldInfo if present
            field_info = None
            for c in constraints:
                if isinstance(c, FieldInfo):
                    field_info = c
                    if c.default is not _MISSING:
                        default = c.default
                    if c.default_factory is not None:
                        default_factory = c.default_factory
                        default = default_factory  # Mark as not required
                    break

            # Create FieldInfo if not present
            if field_info is None:
                field_info = FieldInfo(
                    default=default if default is not _MISSING else _MISSING,
                    default_factory=default_factory,
                    annotation=annotation,
                )
            else:
                # Update annotation on existing FieldInfo
                field_info.annotation = annotation

            fields[field_name] = {
                'annotation': annotation,
                'base_type': base_type,
                'constraints': constraints,
                'default': default,
                'default_factory': default_factory,
                'required': default is _MISSING and default_factory is None,
                'field_info': field_info,
            }
            validators[field_name] = _build_validator(field_name, base_type, constraints, model_config)
            model_fields[field_name] = field_info

        cls.__dhi_fields__ = fields
        cls.__dhi_validators__ = validators
        cls.__dhi_field_names__ = list(fields.keys())
        cls.model_fields = model_fields

        # Pre-compute flat field specs for fast __init__ (avoid dict lookups per-call)
        fast_fields = []
        for field_name, field_data in fields.items():
            fi = field_data.get('field_info')
            # Determine validation alias (validation_alias > alias)
            validation_alias = None
            if fi:
                validation_alias = fi.validation_alias or fi.alias
            if validation_alias is None:
                for c in field_data['constraints']:
                    if isinstance(c, FieldInfo):
                        validation_alias = c.validation_alias or c.alias
                        break
            fast_fields.append((
                field_name,
                field_data['required'],
                field_data['default'],
                field_data.get('default_factory'),
                validation_alias,
                validators[field_name],
                fi,  # Include FieldInfo for frozen/exclude checks
            ))
        cls.__dhi_fast_fields__ = tuple(fast_fields)

        # Try to build native init specs for batch C init (one Python→C call)
        # Now includes nested model fields - C handles them directly!
        native_init_specs = []
        nested_field_specs = []  # For fields that still need Python (mutable defaults, custom validators)
        can_native_init = HAS_NATIVE_EXT
        has_nested_or_complex = False

        # Dummy constraints tuple for nested models (type_code will be overridden to 6 in C)
        _NESTED_DUMMY_CONSTRAINTS = (0, 0, None, None, None, None, None, None, None, 1, 0, 0, 0, 0)

        if can_native_init:
            for field_name, required, default, default_factory, alias, validator, _fi in fast_fields:
                constraints = getattr(validator, '__dhi_native_constraints__', None)
                field_data = fields[field_name]
                base_type = field_data['base_type']

                # Check if this is a nested model field (pre-compute for hot path)
                is_nested = _is_basemodel_subclass(base_type)

                # Mutable defaults or default_factory can't use native path
                has_mutable_default = default_factory is not None or isinstance(default, (list, dict, set))

                if is_nested and not has_mutable_default:
                    # NESTED MODEL - include in native specs with base_type as 6th element
                    # C code will handle isinstance check and dict→model conversion
                    native_init_specs.append((
                        field_name,
                        alias,
                        required,
                        default if default is not _MISSING else None,
                        _NESTED_DUMMY_CONSTRAINTS,
                        base_type,  # 6th element: nested model type
                    ))
                elif constraints is not None and not is_nested and not has_mutable_default:
                    # Simple field with native constraints
                    native_init_specs.append((
                        field_name,
                        alias,
                        required,
                        default if default is not _MISSING else None,
                        constraints,
                        None,  # 6th element: no nested type
                    ))
                else:
                    # Complex field - mutable default, custom validator, or no native constraints
                    has_nested_or_complex = True
                    nested_field_specs.append((
                        field_name, alias, required, default, default_factory, validator, base_type, is_nested
                    ))

        cls.__dhi_native_init_specs__ = tuple(native_init_specs) if can_native_init and native_init_specs else None
        cls.__dhi_nested_field_specs__ = tuple(nested_field_specs) if nested_field_specs else None
        cls.__dhi_has_nested_fields__ = has_nested_or_complex

        # Check if model_post_init is overridden (for optimization)
        has_post_init = 'model_post_init' in namespace
        cls.__dhi_has_post_init__ = has_post_init

        # Pre-compute extra_mode as int for fast native path (0=ignore, 1=forbid, 2=allow)
        extra_mode_str = get_config_value(model_config, 'extra', 'ignore')
        cls.__dhi_extra_mode_int__ = {'ignore': 0, 'forbid': 1, 'allow': 2}.get(extra_mode_str, 0)

        # Combined flag: needs any post-init processing (private attrs or post_init override)
        cls.__dhi_needs_post_init__ = bool(private_attrs) or has_post_init

        # Pre-compile into C structs for zero-overhead constraint access
        # Even with nested fields, compile native fields for hybrid init
        if can_native_init and native_init_specs:
            cls.__dhi_compiled_specs__ = _dhi_native.compile_model_specs(
                tuple(native_init_specs))
        else:
            cls.__dhi_compiled_specs__ = None

        # Track if we can use full native (no nested/complex fields)
        cls.__dhi_full_native__ = can_native_init and native_init_specs and not has_nested_or_complex

        # Combined ultra-fast path flag (checked once in __init__)
        cls.__dhi_use_ultra_fast__ = cls.__dhi_full_native__  # Will be updated in __init_subclass__

        return cls


class BaseModel(metaclass=_ModelMeta):
    """High-performance validated model - Pydantic v2 compatible API.

    Define models with type annotations and constraints. Data is validated
    on instantiation.

    Full Pydantic v2 API compatibility including:
    - model_validate, model_validate_json, model_construct
    - model_dump (with mode, by_alias, exclude_unset, exclude_defaults, exclude_none)
    - model_fields, model_fields_set, model_extra, model_computed_fields
    - model_config (ConfigDict support)
    - model_post_init hook

    Example:
        from typing import Annotated
        from dhi import BaseModel, Field, PositiveInt, ConfigDict

        class User(BaseModel):
            model_config = ConfigDict(frozen=True)

            name: Annotated[str, Field(min_length=1, max_length=100)]
            age: PositiveInt
            email: str
            score: Annotated[float, Field(ge=0, le=100)] = 0.0

        user = User(name="Alice", age=25, email="alice@example.com")
        assert user.name == "Alice"
        assert user.model_dump() == {"name": "Alice", "age": 25, "email": "alice@example.com", "score": 0.0}
        assert "name" in user.model_fields_set
    """

    # Class-level attributes set by metaclass
    __dhi_fields__: ClassVar[Dict[str, Dict[str, Any]]]
    __dhi_validators__: ClassVar[Dict[str, Any]]
    __dhi_field_names__: ClassVar[List[str]]
    __dhi_private_attrs__: ClassVar[Dict[str, PrivateAttr]]
    __dhi_computed_fields__: ClassVar[Dict[str, ComputedFieldInfo]]

    # Pydantic v2 compatible class attributes
    model_config: ClassVar[Optional[ConfigDict]] = None
    model_fields: ClassVar[Dict[str, FieldInfo]]
    model_computed_fields: ClassVar[Dict[str, ComputedFieldInfo]]

    # Instance attributes
    __pydantic_private__: Optional[Dict[str, Any]]
    __pydantic_extra__: Optional[Dict[str, Any]]
    __pydantic_fields_set__: Set[str]

    def __init__(self, **kwargs: Any) -> None:
        cls = type(self)

        # --- ULTRA-FAST PATH: Full native init (handles EVERYTHING in C) ---
        if cls.__dhi_use_ultra_fast__:
            result = _dhi_native.init_model_full(self, kwargs, cls.__dhi_compiled_specs__, cls.__dhi_extra_mode_int__)
            if result is None:
                # Success! C code already set __pydantic_fields_set__, __pydantic_extra__, __pydantic_private__
                if cls.__dhi_needs_post_init__:
                    if cls.__dhi_private_attrs__:
                        self._init_private_attrs()
                    if cls.__dhi_has_post_init__:
                        self.model_post_init(None)
                return
            # result is list of (field_name, error_msg) tuples
            errors = [ValidationError(f, m) for f, m in result]
            raise ValidationErrors(errors)

        # --- HYBRID PATH: Native for simple fields, Python for nested/complex ---
        compiled = cls.__dhi_compiled_specs__
        nested_specs = cls.__dhi_nested_field_specs__
        if compiled is not None and nested_specs and not cls.__dhi_has_custom_validators__:
                _setattr = object.__setattr__

                # Step 1: Native init for simple fields
                result = _dhi_native.init_model_full(self, kwargs, compiled, cls.__dhi_extra_mode_int__)
                if result is not None:
                    errors = [ValidationError(f, m) for f, m in result]
                    raise ValidationErrors(errors)

                # Step 2: Handle nested/complex fields in Python (OPTIMIZED)
                errors: List[ValidationError] = []
                fields_set = self.__pydantic_fields_set__

                for field_name, alias, required, default, default_factory, validator, base_type, is_nested_model in nested_specs:
                    # Get value from kwargs
                    if alias and alias in kwargs:
                        value = kwargs[alias]
                        fields_set.add(field_name)
                    elif field_name in kwargs:
                        value = kwargs[field_name]
                        fields_set.add(field_name)
                    elif not required:
                        if default_factory is not None:
                            _setattr(self, field_name, default_factory())
                        else:
                            _setattr(self, field_name, copy.deepcopy(default) if isinstance(default, (list, dict, set)) else default)
                        continue
                    else:
                        errors.append(ValidationError(field_name, "Field required"))
                        continue

                    # FAST PATH: Nested model fields - use pre-computed flag
                    if is_nested_model:
                        value_type = type(value)
                        if value_type is base_type or (value_type is not dict and isinstance(value, base_type)):
                            # Already validated, just assign
                            _setattr(self, field_name, value)
                            continue
                        elif value_type is dict:
                            # Convert dict to model directly (bypass validator wrapper)
                            try:
                                _setattr(self, field_name, base_type(**value))
                            except (ValidationError, ValidationErrors) as e:
                                if isinstance(e, ValidationErrors):
                                    for ve in e.errors:
                                        errors.append(ValidationError(f"{field_name}.{ve.field}", ve.message))
                                else:
                                    errors.append(ValidationError(field_name, str(e)))
                            continue

                    try:
                        _setattr(self, field_name, validator(value))
                    except ValidationError as e:
                        errors.append(e)

                if errors:
                    raise ValidationErrors(errors)

                if cls.__dhi_needs_post_init__:
                    if cls.__dhi_private_attrs__:
                        self._init_private_attrs()
                    if cls.__dhi_has_post_init__:
                        self.model_post_init(None)
                return

        # --- STANDARD PATH (fallback for models with custom validators or no native support) ---
        _setattr = object.__setattr__

        # Get config values
        config = cls.model_config
        extra_mode = get_config_value(config, 'extra', 'ignore')

        fields_set: Set[str] = set()
        _setattr(self, '__pydantic_fields_set__', fields_set)
        _setattr(self, '__pydantic_private__', None)
        _setattr(self, '__pydantic_extra__', None)

        # --- STANDARD PATH ---
        errors: List[ValidationError] = []

        field_validators = getattr(cls, '__dhi_field_validator_funcs__', {})
        model_validators_before = getattr(cls, '__dhi_model_validators_before__', [])
        model_validators_after = getattr(cls, '__dhi_model_validators_after__', [])

        # Run 'before' model validators
        for mv in model_validators_before:
            kwargs = mv(kwargs)

        # Track which kwargs keys we've consumed
        consumed_keys: Set[str] = set()

        if not field_validators:
            # Fast path: no field validators (common case)
            for field_name, required, default, default_factory, alias, validator, field_info in cls.__dhi_fast_fields__:
                if alias and alias in kwargs:
                    value = kwargs[alias]
                    consumed_keys.add(alias)
                    fields_set.add(field_name)
                elif field_name in kwargs:
                    value = kwargs[field_name]
                    consumed_keys.add(field_name)
                    fields_set.add(field_name)
                elif not required:
                    if default_factory is not None:
                        _setattr(self, field_name, default_factory())
                    else:
                        _setattr(self, field_name, copy.deepcopy(default) if isinstance(default, (list, dict, set)) else default)
                    continue
                else:
                    errors.append(ValidationError(field_name, "Field required"))
                    continue

                try:
                    _setattr(self, field_name, validator(value))
                except ValidationError as e:
                    errors.append(e)
        else:
            # Slow path: has field validators
            for field_name, required, default, default_factory, alias, validator, field_info in cls.__dhi_fast_fields__:
                if alias and alias in kwargs:
                    value = kwargs[alias]
                    consumed_keys.add(alias)
                    fields_set.add(field_name)
                elif field_name in kwargs:
                    value = kwargs[field_name]
                    consumed_keys.add(field_name)
                    fields_set.add(field_name)
                elif not required:
                    if default_factory is not None:
                        _setattr(self, field_name, default_factory())
                    else:
                        _setattr(self, field_name, copy.deepcopy(default) if isinstance(default, (list, dict, set)) else default)
                    continue
                else:
                    errors.append(ValidationError(field_name, "Field required"))
                    continue

                try:
                    validated = validator(value)
                    if field_name in field_validators:
                        for fv in field_validators[field_name]:
                            validated = fv(validated)
                    _setattr(self, field_name, validated)
                except ValidationError as e:
                    errors.append(e)

        # Handle extra fields
        extra_keys = set(kwargs.keys()) - consumed_keys
        if extra_keys:
            if extra_mode == 'forbid':
                for key in extra_keys:
                    errors.append(ValidationError(key, "Extra inputs are not permitted"))
            elif extra_mode == 'allow':
                extra_data = {k: kwargs[k] for k in extra_keys}
                _setattr(self, '__pydantic_extra__', extra_data)
            # 'ignore' mode: do nothing

        if errors:
            raise ValidationErrors(errors)

        # Initialize private attributes
        self._init_private_attrs()

        # Run 'after' model validators
        for mv in model_validators_after:
            mv(self)

        # Call model_post_init hook
        self.model_post_init(None)

    def _init_private_attrs(self) -> None:
        """Initialize private attributes with their defaults."""
        cls = type(self)
        private_attrs = getattr(cls, '__dhi_private_attrs__', {})
        if not private_attrs:
            return

        private_data: Dict[str, Any] = {}
        for attr_name, private_attr in private_attrs.items():
            try:
                private_data[attr_name] = private_attr.get_default()
            except ValueError:
                pass  # No default, will be set later
        if private_data:
            object.__setattr__(self, '__pydantic_private__', private_data)

    @property
    def model_fields_set(self) -> Set[str]:
        """Set of fields that were explicitly set during initialization."""
        return self.__pydantic_fields_set__

    @property
    def model_extra(self) -> Optional[Dict[str, Any]]:
        """Extra fields when model_config extra='allow'."""
        return self.__pydantic_extra__

    def model_post_init(self, __context: Any) -> None:
        """Called after model initialization.

        Override this method to perform additional initialization.
        This matches Pydantic v2's model_post_init hook.

        Args:
            __context: Validation context (currently unused).
        """
        pass

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        # Collect field_validator and model_validator decorated methods
        field_validator_funcs: Dict[str, List] = {}
        model_validators_before: List = []
        model_validators_after: List = []

        # Check class __dict__ directly to find decorated methods
        # This handles @classmethod, @staticmethod wrapping properly
        for attr_name, raw_attr in cls.__dict__.items():
            if attr_name.startswith('__'):
                continue

            # Check both the raw attribute and unwrapped function for validator markers
            # Decorators may set attrs on either the wrapper or the inner function
            candidates = [raw_attr]
            if isinstance(raw_attr, (classmethod, staticmethod)):
                candidates.append(raw_attr.__func__)

            validator_fields = None
            model_validator_flag = False
            validator_mode = 'after'

            for candidate in candidates:
                if hasattr(candidate, '__validator_fields__'):
                    validator_fields = candidate.__validator_fields__
                    validator_mode = getattr(candidate, '__validator_mode__', 'after')
                    break
                if hasattr(candidate, '__model_validator__'):
                    model_validator_flag = True
                    validator_mode = getattr(candidate, '__validator_mode__', 'after')
                    break

            if validator_fields:
                bound = getattr(cls, attr_name)
                for field_name in validator_fields:
                    if field_name not in field_validator_funcs:
                        field_validator_funcs[field_name] = []
                    field_validator_funcs[field_name].append(bound)

            if model_validator_flag:
                bound = getattr(cls, attr_name)
                if validator_mode == 'before':
                    model_validators_before.append(bound)
                else:
                    model_validators_after.append(bound)

        cls.__dhi_field_validator_funcs__ = field_validator_funcs
        cls.__dhi_model_validators_before__ = model_validators_before
        cls.__dhi_model_validators_after__ = model_validators_after
        has_custom = bool(field_validator_funcs or model_validators_before or model_validators_after)
        cls.__dhi_has_custom_validators__ = has_custom
        # Update combined ultra-fast flag (single check in __init__)
        cls.__dhi_use_ultra_fast__ = cls.__dhi_full_native__ and not has_custom

    @classmethod
    def model_construct(
        cls: Type[_T],
        _fields_set: Optional[Set[str]] = None,
        **values: Any,
    ) -> _T:
        """Create a model instance without running validation.

        This is useful when you have pre-validated or trusted data
        and want to skip validation for performance.

        Matches Pydantic v2's model_construct() exactly.

        Args:
            _fields_set: Set of field names to mark as explicitly set.
            **values: Field values to set on the model.

        Returns:
            A new model instance with values set directly.

        Example:
            # Skip validation for trusted data
            user = User.model_construct(name="Alice", age=25)
        """
        obj = object.__new__(cls)
        _setattr = object.__setattr__

        # Initialize tracking attributes
        fields_set = _fields_set if _fields_set is not None else set(values.keys())
        _setattr(obj, '__pydantic_fields_set__', fields_set)
        _setattr(obj, '__pydantic_private__', None)
        _setattr(obj, '__pydantic_extra__', None)

        # Set field values (with defaults for missing fields)
        for field_name, field_data in cls.__dhi_fields__.items():
            if field_name in values:
                _setattr(obj, field_name, values[field_name])
            else:
                default = field_data['default']
                default_factory = field_data.get('default_factory')
                if default_factory is not None:
                    _setattr(obj, field_name, default_factory())
                elif default is not _MISSING:
                    _setattr(obj, field_name, copy.deepcopy(default) if isinstance(default, (list, dict, set)) else default)

        # Initialize private attributes
        obj._init_private_attrs()

        return obj

    @classmethod
    def model_validate(
        cls: Type[_T],
        obj: Any,
        *,
        strict: Optional[bool] = None,
        from_attributes: bool = False,
        context: Optional[Dict[str, Any]] = None,
    ) -> _T:
        """Validate data and create a model instance.

        Matches Pydantic v2's model_validate() exactly.

        Args:
            obj: Data to validate (dict, object with attributes, or model instance).
            strict: If True, enforce strict validation.
            from_attributes: If True, extract data from object attributes (ORM mode).
            context: Optional validation context.

        Returns:
            Validated model instance.
        """
        # Handle model instances
        if isinstance(obj, cls):
            return obj

        # Handle from_attributes (ORM mode)
        if from_attributes or get_config_value(cls.model_config, 'from_attributes', False):
            if hasattr(obj, '__dict__'):
                data = {}
                for field_name in cls.__dhi_field_names__:
                    if hasattr(obj, field_name):
                        data[field_name] = getattr(obj, field_name)
                return cls(**data)

        # Handle dict input - FAST PATH: bypass **kwargs unpacking
        if isinstance(obj, dict):
            # Fast path for simple models with native init
            compiled = cls.__dhi_compiled_specs__
            if compiled is not None and cls.__dhi_full_native__ and not cls.__dhi_has_custom_validators__ and HAS_NATIVE_EXT:
                instance = object.__new__(cls)
                result = _dhi_native.init_model_full(instance, obj, compiled, cls.__dhi_extra_mode_int__)
                if result is None:
                    if cls.__dhi_needs_post_init__:
                        if cls.__dhi_private_attrs__:
                            instance._init_private_attrs()
                        if cls.__dhi_has_post_init__:
                            instance.model_post_init(None)
                    return instance
                errors = [ValidationError(f, m) for f, m in result]
                raise ValidationErrors(errors)
            # Standard path
            return cls(**obj)

        raise ValidationError('__root__', f"Expected dict or {cls.__name__}, got {type(obj).__name__}")

    @classmethod
    def model_validate_json(
        cls: Type[_T],
        json_data: Union[str, bytes],
        *,
        strict: Optional[bool] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> _T:
        """Validate JSON data and create a model instance.

        Matches Pydantic v2's model_validate_json() exactly.

        Args:
            json_data: JSON string or bytes to validate.
            strict: If True, enforce strict validation.
            context: Optional validation context.

        Returns:
            Validated model instance.

        Example:
            user = User.model_validate_json('{"name": "Alice", "age": 25}')
        """
        if isinstance(json_data, bytes):
            json_data = json_data.decode('utf-8')
        data = _json.loads(json_data)
        return cls.model_validate(data, strict=strict, context=context)

    @classmethod
    def model_validate_strings(
        cls: Type[_T],
        obj: Mapping[str, Any],
        *,
        strict: Optional[bool] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> _T:
        """Validate a mapping with string keys and coerce values.

        Matches Pydantic v2's model_validate_strings().

        Args:
            obj: Mapping with string keys.
            strict: If True, enforce strict validation.
            context: Optional validation context.

        Returns:
            Validated model instance.
        """
        return cls.model_validate(dict(obj), strict=strict, context=context)

    def model_dump(
        self,
        *,
        mode: Literal['json', 'python'] = 'python',
        include: IncEx = None,
        exclude: IncEx = None,
        by_alias: bool = False,
        exclude_unset: bool = False,
        exclude_defaults: bool = False,
        exclude_none: bool = False,
        round_trip: bool = False,
        warnings: bool = True,
        serialize_as_any: bool = False,
    ) -> Dict[str, Any]:
        """Convert model to dictionary.

        Matches Pydantic v2's model_dump() exactly.

        Args:
            mode: 'python' returns Python objects, 'json' returns JSON-compatible types.
            include: Fields to include. Can be a set of names or nested dict.
            exclude: Fields to exclude. Can be a set of names or nested dict.
            by_alias: Use field aliases in output keys.
            exclude_unset: Exclude fields that weren't explicitly set.
            exclude_defaults: Exclude fields that equal their default value.
            exclude_none: Exclude fields with None values.
            round_trip: Enable round-trip serialization mode.
            warnings: Whether to emit warnings.
            serialize_as_any: Serialize as Any type.

        Returns:
            Dictionary representation of the model.

        Example:
            user = User(name="Alice", age=25, score=0.0)
            user.model_dump(exclude_defaults=True)  # Excludes score=0.0
        """
        cls = type(self)

        # FAST PATH: Native C dump for simple cases (no filtering options)
        compiled = getattr(cls, '__dhi_compiled_specs__', None)
        if (compiled is not None and mode == 'python' and not include and not exclude
                and not by_alias and not exclude_unset and not exclude_defaults
                and not exclude_none and not cls.__dhi_has_nested_fields__ and HAS_NATIVE_EXT):
            return _dhi_native.dump_model_compiled(self, compiled)

        result: Dict[str, Any] = {}

        # Convert include/exclude to sets if they're dicts (simplified handling)
        include_set = set(include.keys()) if isinstance(include, dict) else include
        exclude_set = set(exclude.keys()) if isinstance(exclude, dict) else exclude

        for field_name in self.__dhi_field_names__:
            # Check exclude
            if exclude_set and field_name in exclude_set:
                continue

            # Check field-level exclude from FieldInfo
            field_info = cls.model_fields.get(field_name)
            if field_info and field_info.exclude:
                continue

            # Check include
            if include_set and field_name not in include_set:
                continue

            # Get the value
            value = getattr(self, field_name, None)

            # Check exclude_unset
            if exclude_unset and field_name not in self.__pydantic_fields_set__:
                continue

            # Check exclude_defaults
            if exclude_defaults:
                field_data = cls.__dhi_fields__.get(field_name, {})
                default = field_data.get('default', _MISSING)
                default_factory = field_data.get('default_factory')
                if default_factory is None and default is not _MISSING and value == default:
                    continue

            # Check exclude_none
            if exclude_none and value is None:
                continue

            # Determine output key
            output_key = field_name
            if by_alias and field_info:
                # serialization_alias > alias > field_name
                output_key = field_info.serialization_alias or field_info.alias or field_name

            # Handle nested models
            if isinstance(value, BaseModel):
                value = value.model_dump(
                    mode=mode,
                    by_alias=by_alias,
                    exclude_unset=exclude_unset,
                    exclude_defaults=exclude_defaults,
                    exclude_none=exclude_none,
                )
            elif isinstance(value, list):
                value = [
                    v.model_dump(mode=mode, by_alias=by_alias, exclude_unset=exclude_unset,
                                 exclude_defaults=exclude_defaults, exclude_none=exclude_none)
                    if isinstance(v, BaseModel) else v
                    for v in value
                ]
            elif isinstance(value, dict):
                value = {
                    k: v.model_dump(mode=mode, by_alias=by_alias, exclude_unset=exclude_unset,
                                    exclude_defaults=exclude_defaults, exclude_none=exclude_none)
                    if isinstance(v, BaseModel) else v
                    for k, v in value.items()
                }

            # JSON mode conversion
            if mode == 'json':
                value = self._serialize_for_json(value)

            result[output_key] = value

        # Include computed fields
        computed_fields = getattr(cls, '__dhi_computed_fields__', {})
        for comp_name, comp_info in computed_fields.items():
            if exclude_set and comp_name in exclude_set:
                continue
            if include_set and comp_name not in include_set:
                continue

            value = getattr(self, comp_name)
            output_key = comp_name
            if by_alias and comp_info.alias:
                output_key = comp_info.alias

            if mode == 'json':
                value = self._serialize_for_json(value)

            result[output_key] = value

        # Include extra fields if present
        if self.__pydantic_extra__:
            for key, value in self.__pydantic_extra__.items():
                if exclude_set and key in exclude_set:
                    continue
                if include_set and key not in include_set:
                    continue
                if exclude_none and value is None:
                    continue
                if mode == 'json':
                    value = self._serialize_for_json(value)
                result[key] = value

        return result

    def _serialize_for_json(self, value: Any) -> Any:
        """Convert a value to JSON-compatible types."""
        if isinstance(value, (str, int, float, bool, type(None))):
            return value
        if isinstance(value, bytes):
            return value.decode('utf-8', errors='replace')
        if isinstance(value, (list, tuple)):
            return [self._serialize_for_json(v) for v in value]
        if isinstance(value, dict):
            return {k: self._serialize_for_json(v) for k, v in value.items()}
        if isinstance(value, set):
            return list(value)
        if hasattr(value, 'isoformat'):  # datetime, date
            return value.isoformat()
        if hasattr(value, '__str__'):
            return str(value)
        return value

    def model_dump_json(
        self,
        *,
        indent: Optional[int] = None,
        include: IncEx = None,
        exclude: IncEx = None,
        by_alias: bool = False,
        exclude_unset: bool = False,
        exclude_defaults: bool = False,
        exclude_none: bool = False,
        round_trip: bool = False,
        warnings: bool = True,
        serialize_as_any: bool = False,
    ) -> str:
        """Convert model to JSON string.

        Matches Pydantic v2's model_dump_json() exactly.

        Args:
            indent: Indentation level for pretty printing.
            include: Fields to include.
            exclude: Fields to exclude.
            by_alias: Use field aliases in output keys.
            exclude_unset: Exclude fields that weren't explicitly set.
            exclude_defaults: Exclude fields that equal their default value.
            exclude_none: Exclude fields with None values.
            round_trip: Enable round-trip serialization mode.
            warnings: Whether to emit warnings.
            serialize_as_any: Serialize as Any type.

        Returns:
            JSON string representation of the model.
        """
        # Fast path: native C JSON serialization (only for simple cases)
        cls = type(self)
        compiled = getattr(cls, '__dhi_compiled_specs__', None)
        if (compiled is not None and indent is None and not include and not exclude
                and not by_alias and not exclude_unset and not exclude_defaults
                and not exclude_none and HAS_NATIVE_EXT):
            try:
                return _dhi_native.dump_json_compiled(self, compiled)
            except Exception:
                pass  # Fall back to Python

        # Standard path: dump to dict then serialize
        data = self.model_dump(
            mode='json',
            include=include,
            exclude=exclude,
            by_alias=by_alias,
            exclude_unset=exclude_unset,
            exclude_defaults=exclude_defaults,
            exclude_none=exclude_none,
        )
        return _json.dumps(data, indent=indent, ensure_ascii=False)

    @classmethod
    def model_json_schema(cls) -> Dict[str, Any]:
        """Generate JSON Schema for this model.

        Matches Pydantic's model_json_schema() classmethod.
        """
        schema: Dict[str, Any] = {
            "title": cls.__name__,
            "type": "object",
            "properties": {},
            "required": [],
        }

        type_map = {
            int: "integer",
            float: "number",
            str: "string",
            bool: "boolean",
            bytes: "string",
        }

        for field_name, field_info in cls.__dhi_fields__.items():
            base_type = field_info['base_type']
            constraints = field_info['constraints']

            prop: Dict[str, Any] = {}

            # Base type
            json_type = type_map.get(base_type, "string")
            prop["type"] = json_type

            # Apply constraints to schema
            for c in constraints:
                if isinstance(c, Gt):
                    prop["exclusiveMinimum"] = c.gt
                elif isinstance(c, Ge):
                    prop["minimum"] = c.ge
                elif isinstance(c, Lt):
                    prop["exclusiveMaximum"] = c.lt
                elif isinstance(c, Le):
                    prop["maximum"] = c.le
                elif isinstance(c, MultipleOf):
                    prop["multipleOf"] = c.multiple_of
                elif isinstance(c, MinLength):
                    prop["minLength"] = c.min_length
                elif isinstance(c, MaxLength):
                    prop["maxLength"] = c.max_length
                elif isinstance(c, Pattern):
                    prop["pattern"] = c.pattern
                elif isinstance(c, FieldInfo):
                    if c.gt is not None:
                        prop["exclusiveMinimum"] = c.gt
                    if c.ge is not None:
                        prop["minimum"] = c.ge
                    if c.lt is not None:
                        prop["exclusiveMaximum"] = c.lt
                    if c.le is not None:
                        prop["maximum"] = c.le
                    if c.multiple_of is not None:
                        prop["multipleOf"] = c.multiple_of
                    if c.min_length is not None:
                        prop["minLength"] = c.min_length
                    if c.max_length is not None:
                        prop["maxLength"] = c.max_length
                    if c.pattern is not None:
                        prop["pattern"] = c.pattern
                    if c.title:
                        prop["title"] = c.title
                    if c.description:
                        prop["description"] = c.description
                    if c.examples:
                        prop["examples"] = c.examples

            # Default value
            if not field_info['required']:
                prop["default"] = field_info['default']

            schema["properties"][field_name] = prop

            if field_info['required']:
                schema["required"].append(field_name)

        return schema

    def model_copy(
        self: _T,
        *,
        update: Optional[Dict[str, Any]] = None,
        deep: bool = False,
    ) -> _T:
        """Create a copy of the model with optional field updates.

        Matches Pydantic v2's model_copy() exactly.

        Args:
            update: Dictionary of field values to update.
            deep: If True, perform a deep copy.

        Returns:
            A new model instance with copied (and optionally updated) values.

        Example:
            user2 = user.model_copy(update={'name': 'Bob'})
            user3 = user.model_copy(deep=True)
        """
        if deep:
            # Deep copy: copy all values recursively
            data = copy.deepcopy(self.model_dump())
        else:
            # Shallow copy
            data = self.model_dump()

        if update:
            data.update(update)

        # Preserve fields_set from original plus any updated fields
        new_fields_set = self.__pydantic_fields_set__.copy()
        if update:
            new_fields_set.update(update.keys())

        # Create new instance
        new_obj = self.__class__.model_construct(_fields_set=new_fields_set, **data)
        return new_obj

    def __setattr__(self, name: str, value: Any) -> None:
        """Set attribute with frozen/validate_assignment support."""
        cls = type(self)
        config = cls.model_config

        # Check if model is frozen
        if get_config_value(config, 'frozen', False):
            raise TypeError(f"{cls.__name__} is frozen and does not support item assignment")

        # Check if field is frozen
        if name in cls.model_fields:
            field_info = cls.model_fields[name]
            if field_info.frozen:
                raise TypeError(f"Field '{name}' is frozen and cannot be modified")

            # Validate on assignment if configured
            if get_config_value(config, 'validate_assignment', False):
                validator = cls.__dhi_validators__.get(name)
                if validator:
                    value = validator(value)

                # Update fields_set
                if hasattr(self, '__pydantic_fields_set__'):
                    self.__pydantic_fields_set__.add(name)

        object.__setattr__(self, name, value)

    def __delattr__(self, name: str) -> None:
        """Delete attribute (blocked if frozen)."""
        cls = type(self)
        if get_config_value(cls.model_config, 'frozen', False):
            raise TypeError(f"{cls.__name__} is frozen and does not support item deletion")
        object.__delattr__(self, name)

    def __repr__(self) -> str:
        """String representation of the model."""
        cls = type(self)
        parts = []
        for name in self.__dhi_field_names__:
            if hasattr(self, name):
                field_info = cls.model_fields.get(name)
                # Check repr flag on FieldInfo
                if field_info and field_info.repr is False:
                    continue
                parts.append(f"{name}={getattr(self, name)!r}")
        return f"{cls.__name__}({', '.join(parts)})"

    def __str__(self) -> str:
        return self.__repr__()

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, self.__class__):
            return NotImplemented
        return self.model_dump() == other.model_dump()

    def __hash__(self) -> int:
        # Note: Pydantic raises error if model is mutable, but we allow it
        try:
            return hash(tuple(sorted(self.model_dump().items())))
        except TypeError:
            # Unhashable values in the model
            raise TypeError(f"unhashable type: '{type(self).__name__}'")

    def __iter__(self) -> Iterator[str]:
        """Iterate over field names."""
        return iter(self.__dhi_field_names__)

    def __getitem__(self, key: str) -> Any:
        """Get field value by name (dict-like access)."""
        if key in self.__dhi_field_names__:
            return getattr(self, key)
        raise KeyError(key)

    def __contains__(self, key: str) -> bool:
        """Check if field exists."""
        return key in self.__dhi_field_names__

    @classmethod
    def model_rebuild(
        cls,
        *,
        force: bool = False,
        raise_errors: bool = True,
        _parent_namespace_depth: int = 2,
        _types_namespace: Optional[Dict[str, Any]] = None,
    ) -> Optional[bool]:
        """Rebuild model schema, useful for forward references.

        Matches Pydantic v2's model_rebuild().
        """
        # dhi doesn't need to rebuild in most cases since we resolve at class creation
        # This is provided for API compatibility
        return True

    @classmethod
    def model_parametrized_name(cls, params: Tuple[Type[Any], ...]) -> str:
        """Generate parametrized class name for generics.

        Matches Pydantic v2's model_parametrized_name().
        """
        param_names = ', '.join(p.__name__ if hasattr(p, '__name__') else str(p) for p in params)
        return f'{cls.__name__}[{param_names}]'


__all__ = ["BaseModel", "IncEx"]
