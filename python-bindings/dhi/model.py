"""
BaseModel implementation for dhi - Pydantic v2 compatible.

Provides a lightweight, high-performance BaseModel that validates data
on instantiation using type annotations and constraints.

Example:
    from typing import Annotated
    from dhi import BaseModel, Field, PositiveInt, EmailStr

    class User(BaseModel):
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
from typing import (
    Any, Dict, List, Optional, Set, Type, Tuple, Union,
    get_type_hints,
)

try:
    from typing import get_args, get_origin, Annotated
except ImportError:
    from typing_extensions import get_args, get_origin, Annotated

from .constraints import (
    Gt, Ge, Lt, Le, MultipleOf,
    MinLength, MaxLength, Pattern,
    Strict, StripWhitespace, ToLower, ToUpper,
    AllowInfNan, MaxDigits, DecimalPlaces, UniqueItems,
    StringConstraints,
)
from .fields import FieldInfo, Field, _MISSING
from .validator import ValidationError, ValidationErrors, HAS_NATIVE_EXT

if HAS_NATIVE_EXT:
    from . import _dhi_native

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


def _build_validator(field_name: str, base_type: Type, constraints: List[Any]) -> Any:
    """Build a compiled validator function for a field.

    Returns a function that takes a value and returns the validated/transformed value,
    or raises ValidationError.
    """
    # Collect all constraints from both individual metadata and FieldInfo objects
    gt = ge = lt = le = multiple_of = None
    min_length = max_length = None
    pattern_str = None
    strict = False
    strip_whitespace = to_lower = to_upper = False
    allow_inf_nan = True
    max_digits = decimal_places = None
    unique_items = False
    custom_validators: List[Any] = []

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

        # Custom validators (objects with .validate() or callables)
        for custom_val in custom_validators:
            if hasattr(custom_val, 'validate'):
                value = custom_val.validate(value, field_name)
            else:
                value = custom_val(value)

        return value

    # --- NATIVE ACCELERATION PATH ---
    # Use C extension for type check + numeric bounds + string length in one call.
    # Falls back to Python for: regex patterns, decimal constraints, unique items.
    can_use_native = (
        HAS_NATIVE_EXT
        and compiled_pattern is None
        and max_digits is None
        and decimal_places is None
        and not unique_items
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
            return cls

        # Get type hints including Annotated metadata
        try:
            hints = get_type_hints(cls, include_extras=True)
        except Exception:
            hints = {}

        # Build field info and validators
        fields: Dict[str, Dict[str, Any]] = {}
        validators: Dict[str, Any] = {}

        for field_name, annotation in hints.items():
            if field_name.startswith('_'):
                continue

            base_type, constraints = _extract_constraints(annotation)

            # Check for class-level default
            default = namespace.get(field_name, _MISSING)
            default_factory = None

            # Check if any constraint is a FieldInfo with a default
            for c in constraints:
                if isinstance(c, FieldInfo):
                    if c.default is not _MISSING:
                        default = c.default
                        break
                    if c.default_factory is not None:
                        default_factory = c.default_factory
                        default = default_factory  # Mark as not required
                        break

            fields[field_name] = {
                'annotation': annotation,
                'base_type': base_type,
                'constraints': constraints,
                'default': default,
                'default_factory': default_factory,
                'required': default is _MISSING and default_factory is None,
            }
            validators[field_name] = _build_validator(field_name, base_type, constraints)

        cls.__dhi_fields__ = fields
        cls.__dhi_validators__ = validators
        cls.__dhi_field_names__ = list(fields.keys())

        # Pre-compute flat field specs for fast __init__ (avoid dict lookups per-call)
        fast_fields = []
        for field_name, field_info in fields.items():
            alias = None
            for c in field_info['constraints']:
                if isinstance(c, FieldInfo) and c.alias:
                    alias = c.alias
                    break
            fast_fields.append((
                field_name,
                field_info['required'],
                field_info['default'],
                field_info.get('default_factory'),
                alias,
                validators[field_name],
            ))
        cls.__dhi_fast_fields__ = tuple(fast_fields)

        # Try to build native init specs for batch C init (one Python→C call)
        # Requirements: all fields fully native, no default_factory, no mutable defaults
        native_init_specs = []
        can_native_init = HAS_NATIVE_EXT
        if can_native_init:
            for field_name, required, default, default_factory, alias, validator in fast_fields:
                if default_factory is not None:
                    can_native_init = False
                    break
                if isinstance(default, (list, dict, set)):
                    can_native_init = False
                    break
                constraints = getattr(validator, '__dhi_native_constraints__', None)
                if constraints is None:
                    can_native_init = False
                    break
                native_init_specs.append((
                    field_name,
                    alias,
                    required,
                    default if default is not _MISSING else None,
                    constraints,
                ))
        cls.__dhi_native_init_specs__ = tuple(native_init_specs) if can_native_init else None

        return cls


class BaseModel(metaclass=_ModelMeta):
    """High-performance validated model - Pydantic v2 compatible API.

    Define models with type annotations and constraints. Data is validated
    on instantiation.

    Example:
        from typing import Annotated
        from dhi import BaseModel, Field, PositiveInt

        class User(BaseModel):
            name: Annotated[str, Field(min_length=1, max_length=100)]
            age: PositiveInt
            email: str
            score: Annotated[float, Field(ge=0, le=100)] = 0.0

        user = User(name="Alice", age=25, email="alice@example.com")
        assert user.name == "Alice"
        assert user.model_dump() == {"name": "Alice", "age": 25, "email": "alice@example.com", "score": 0.0}
    """

    # These are set by the metaclass
    __dhi_fields__: Dict[str, Dict[str, Any]]
    __dhi_validators__: Dict[str, Any]
    __dhi_field_names__: List[str]

    def __init__(self, **kwargs: Any) -> None:
        # --- ULTRA-FAST PATH: Batch C init (one Python→C call for all fields) ---
        native_specs = self.__class__.__dhi_native_init_specs__
        if native_specs is not None:
            field_validators = getattr(self.__class__, '__dhi_field_validator_funcs__', None)
            model_validators_before = getattr(self.__class__, '__dhi_model_validators_before__', None)
            model_validators_after = getattr(self.__class__, '__dhi_model_validators_after__', None)
            if not field_validators and not model_validators_before and not model_validators_after:
                result = _dhi_native.init_model(self, kwargs, native_specs)
                if result is None:
                    return  # Success — all fields validated and set in C
                # result is list of (field_name, error_msg) tuples
                errors = [ValidationError(f, m) for f, m in result]
                raise ValidationErrors(errors)

        # --- STANDARD PATH ---
        errors: List[ValidationError] = []

        field_validators = getattr(self.__class__, '__dhi_field_validator_funcs__', {})
        model_validators_before = getattr(self.__class__, '__dhi_model_validators_before__', [])
        model_validators_after = getattr(self.__class__, '__dhi_model_validators_after__', [])

        # Run 'before' model validators
        for mv in model_validators_before:
            kwargs = mv(kwargs)

        _setattr = object.__setattr__
        if not field_validators:
            # Fast path: no field validators (common case)
            for field_name, required, default, default_factory, alias, validator in self.__dhi_fast_fields__:
                if alias and alias in kwargs:
                    value = kwargs[alias]
                elif field_name in kwargs:
                    value = kwargs[field_name]
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
            for field_name, required, default, default_factory, alias, validator in self.__dhi_fast_fields__:
                if alias and alias in kwargs:
                    value = kwargs[alias]
                elif field_name in kwargs:
                    value = kwargs[field_name]
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

        if errors:
            raise ValidationErrors(errors)

        # Run 'after' model validators
        for mv in model_validators_after:
            mv(self)

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

    @classmethod
    def model_validate(cls, data: Dict[str, Any]) -> "BaseModel":
        """Validate a dictionary and create a model instance.

        Matches Pydantic's model_validate() classmethod.
        """
        return cls(**data)

    def model_dump(self, *, exclude: Optional[Set[str]] = None, include: Optional[Set[str]] = None) -> Dict[str, Any]:
        """Convert model to dictionary.

        Matches Pydantic's model_dump() method.
        """
        result = {}
        for field_name in self.__dhi_field_names__:
            if exclude and field_name in exclude:
                continue
            if include and field_name not in include:
                continue
            result[field_name] = getattr(self, field_name)
        return result

    def model_dump_json(self) -> str:
        """Convert model to JSON string."""
        import json
        return json.dumps(self.model_dump())

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

    def model_copy(self, *, update: Optional[Dict[str, Any]] = None) -> "BaseModel":
        """Create a copy of the model with optional field updates.

        Matches Pydantic's model_copy() method.
        """
        data = self.model_dump()
        if update:
            data.update(update)
        return self.__class__(**data)

    def __repr__(self) -> str:
        fields = ", ".join(
            f"{name}={getattr(self, name)!r}"
            for name in self.__dhi_field_names__
            if hasattr(self, name)
        )
        return f"{self.__class__.__name__}({fields})"

    def __str__(self) -> str:
        return self.__repr__()

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, self.__class__):
            return NotImplemented
        return self.model_dump() == other.model_dump()

    def __hash__(self) -> int:
        return hash(tuple(sorted(self.model_dump().items())))


__all__ = ["BaseModel"]
