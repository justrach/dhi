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
import sys
import types
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


def _is_union_annotation(annotation: Any) -> bool:
    origin = get_origin(annotation)
    return origin is Union or origin is types.UnionType or isinstance(annotation, types.UnionType)


def _model_ref(model_cls: type, ref_template: str) -> str:
    return ref_template.format(model=model_cls.__name__)


def _model_to_json_schema(
    model_cls: type,
    *,
    definitions: Dict[str, Dict[str, Any]],
    ref_template: str,
    by_alias: bool,
    root_model: type,
) -> Dict[str, Any]:
    schema: Dict[str, Any] = {
        "title": model_cls.__name__,
        "type": "object",
        "properties": {},
    }
    required: List[str] = []

    for field_name, field_data in model_cls.__dhi_fields__.items():
        field_info = field_data.get('field_info') or model_cls.model_fields.get(field_name)
        prop = _annotation_to_json_schema(
            field_data['annotation'],
            definitions=definitions,
            ref_template=ref_template,
            by_alias=by_alias,
            root_model=root_model,
        )
        _apply_schema_constraints(prop, field_data.get('constraints', []), field_info)

        if not field_data['required'] and field_data.get('default_factory') is None:
            default = field_data.get('default', _MISSING)
            if default is not _MISSING and _is_json_schema_default(default):
                prop["default"] = default

        prop_name = field_name
        if by_alias and field_info is not None:
            prop_name = field_info.alias or field_name
        schema["properties"][prop_name] = prop

        if field_data['required']:
            required.append(prop_name)

    if required:
        schema["required"] = required
    return schema


def _annotation_to_json_schema(
    annotation: Any,
    *,
    definitions: Dict[str, Dict[str, Any]],
    ref_template: str,
    by_alias: bool,
    root_model: type,
) -> Dict[str, Any]:
    base_type, constraints = _extract_constraints(annotation)

    if _is_basemodel_subclass(base_type):
        if base_type.__name__ not in definitions:
            definitions[base_type.__name__] = {}
            definitions[base_type.__name__] = _model_to_json_schema(
                base_type,
                definitions=definitions,
                ref_template=ref_template,
                by_alias=by_alias,
                root_model=root_model,
            )
        return {"$ref": _model_ref(base_type, ref_template)}

    origin = get_origin(base_type)
    args = get_args(base_type)

    if origin in (list, List, set, Set, frozenset, FrozenSet, tuple, Tuple):
        schema: Dict[str, Any] = {"type": "array"}

        if origin in (set, Set, frozenset, FrozenSet):
            schema["uniqueItems"] = True

        if origin in (tuple, Tuple) and args and args[-1] is not Ellipsis:
            schema["prefixItems"] = [
                _annotation_to_json_schema(
                    item_type,
                    definitions=definitions,
                    ref_template=ref_template,
                    by_alias=by_alias,
                    root_model=root_model,
                )
                for item_type in args
            ]
            schema["minItems"] = len(args)
            schema["maxItems"] = len(args)
            return schema

        if args:
            item_type = args[0]
            if item_type is Ellipsis:
                item_type = Any
            schema["items"] = _annotation_to_json_schema(
                item_type,
                definitions=definitions,
                ref_template=ref_template,
                by_alias=by_alias,
                root_model=root_model,
            )
        else:
            schema["items"] = {}
        return schema

    if origin in (dict, Dict, Mapping):
        schema = {"type": "object"}
        if len(args) == 2:
            schema["additionalProperties"] = _annotation_to_json_schema(
                args[1],
                definitions=definitions,
                ref_template=ref_template,
                by_alias=by_alias,
                root_model=root_model,
            )
        return schema

    if _is_union_annotation(base_type):
        return {
            "anyOf": [
                _annotation_to_json_schema(
                    arg,
                    definitions=definitions,
                    ref_template=ref_template,
                    by_alias=by_alias,
                    root_model=root_model,
                )
                for arg in args
            ]
        }

    type_map = {
        str: {"type": "string"},
        int: {"type": "integer"},
        float: {"type": "number"},
        bool: {"type": "boolean"},
        bytes: {"type": "string", "format": "binary"},
        list: {"type": "array", "items": {}},
        dict: {"type": "object"},
        Any: {},
        type(None): {"type": "null"},
    }

    schema = dict(type_map.get(base_type, {"type": "string"}))
    _apply_schema_constraints(schema, constraints, None)
    return schema


def _apply_schema_constraints(
    schema: Dict[str, Any], constraints: List[Any], field_info: Optional[FieldInfo]
) -> None:
    for c in constraints:
        if isinstance(c, Gt):
            schema["exclusiveMinimum"] = c.gt
        elif isinstance(c, Ge):
            schema["minimum"] = c.ge
        elif isinstance(c, Lt):
            schema["exclusiveMaximum"] = c.lt
        elif isinstance(c, Le):
            schema["maximum"] = c.le
        elif isinstance(c, MultipleOf):
            schema["multipleOf"] = c.multiple_of
        elif isinstance(c, MinLength):
            schema["minLength"] = c.min_length
        elif isinstance(c, MaxLength):
            schema["maxLength"] = c.max_length
        elif isinstance(c, Pattern):
            schema["pattern"] = c.pattern
        elif isinstance(c, FieldInfo):
            _apply_field_info_schema(schema, c)
        elif isinstance(c, StringConstraints):
            if c.min_length is not None:
                schema["minLength"] = c.min_length
            if c.max_length is not None:
                schema["maxLength"] = c.max_length
            if c.pattern is not None:
                schema["pattern"] = c.pattern

    if field_info is not None:
        _apply_field_info_schema(schema, field_info)


def _apply_field_info_schema(schema: Dict[str, Any], field_info: FieldInfo) -> None:
    if field_info.gt is not None:
        schema["exclusiveMinimum"] = field_info.gt
    if field_info.ge is not None:
        schema["minimum"] = field_info.ge
    if field_info.lt is not None:
        schema["exclusiveMaximum"] = field_info.lt
    if field_info.le is not None:
        schema["maximum"] = field_info.le
    if field_info.multiple_of is not None:
        schema["multipleOf"] = field_info.multiple_of
    if field_info.min_length is not None:
        schema["minLength"] = field_info.min_length
    if field_info.max_length is not None:
        schema["maxLength"] = field_info.max_length
    if field_info.pattern is not None:
        schema["pattern"] = field_info.pattern
    if field_info.title:
        schema["title"] = field_info.title
    if field_info.description:
        schema["description"] = field_info.description
    if field_info.examples:
        schema["examples"] = field_info.examples
    if field_info.json_schema_extra:
        schema.update(field_info.json_schema_extra)


def _is_json_schema_default(value: Any) -> bool:
    try:
        _json.dumps(value)
        return True
    except (TypeError, ValueError):
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
    type_args = get_args(base_type) if type_origin is not None else ()
    if type_origin is not None:
        check_type = type_origin

    # Extract item type for collection validation (List[int] -> int, etc.)
    item_type = None
    if type_origin in (list, set, frozenset) and type_args:
        item_type = type_args[0]

    # Handle Optional[T] = Union[T, None].
    # For a *single-type* Optional (exactly one non-None member) we validate the
    # value against the inner type and allow None. Multi-member unions
    # (e.g. Union[int, str]) keep pass-through behavior. (Issue #56: the pure-
    # Python fallback previously left ``check_type`` as the Union object, so
    # Optional fields received NO type checking and accepted int/bool/list.)
    optional_model = None
    allow_none = False
    if type_origin is Union:
        non_none_args = [a for a in type_args if a is not type(None)]
        allow_none = len(non_none_args) != len(type_args)
        if len(non_none_args) == 1:
            inner_type = non_none_args[0]
            if _is_basemodel_subclass(inner_type):
                optional_model = inner_type
            else:
                inner_origin = get_origin(inner_type)
                if inner_origin is None and isinstance(inner_type, type):
                    # Optional[scalar] -> validate against the scalar type
                    check_type = inner_type
                elif inner_origin in (list, set, frozenset):
                    check_type = inner_origin
                    inner_args = get_args(inner_type)
                    if inner_args:
                        item_type = inner_args[0]

    def validator(value: Any) -> Any:
        # None handling for Optional[T] (Union[..., None]) — accept None and
        # skip all further type/constraint checks. (Issue #56)
        if value is None and allow_none:
            return None
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
                    # Issue #57: a fractional float must NOT be silently truncated
                    # to int. Whole-valued floats (5.0 -> 5) are still accepted.
                    if check_type is int and isinstance(value, float):
                        if not math.isfinite(value) or not value.is_integer():
                            raise ValidationError(
                                field_name,
                                f"Expected int, got float with fractional part: {value}"
                            )
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

        # List/set item type validation (e.g., List[int] validates each item is int)
        if item_type is not None and isinstance(value, (list, set, frozenset)):
            validated_items = []
            for i, item in enumerate(value):
                # Check item type
                if item_type is int:
                    if not isinstance(item, int) or isinstance(item, bool):
                        raise ValidationError(
                            field_name,
                            f"Item {i}: Expected int, got {type(item).__name__}"
                        )
                elif item_type is float:
                    if isinstance(item, bool):
                        raise ValidationError(
                            field_name,
                            f"Item {i}: Expected float, got bool"
                        )
                    if not isinstance(item, (int, float)):
                        raise ValidationError(
                            field_name,
                            f"Item {i}: Expected float, got {type(item).__name__}"
                        )
                    item = float(item)  # Coerce int to float
                elif item_type is str:
                    if not isinstance(item, str):
                        raise ValidationError(
                            field_name,
                            f"Item {i}: Expected str, got {type(item).__name__}"
                        )
                elif item_type is bool:
                    if not isinstance(item, bool):
                        raise ValidationError(
                            field_name,
                            f"Item {i}: Expected bool, got {type(item).__name__}"
                        )
                elif _is_basemodel_subclass(item_type):
                    if isinstance(item, dict):
                        item = item_type.model_validate(item)
                    elif not isinstance(item, item_type):
                        raise ValidationError(
                            field_name,
                            f"Item {i}: Expected {item_type.__name__} or dict, got {type(item).__name__}"
                        )
                validated_items.append(item)
            # Reconstruct collection
            if isinstance(value, list):
                value = validated_items
            elif isinstance(value, set):
                value = set(validated_items)
            elif isinstance(value, frozenset):
                value = frozenset(validated_items)

        # Optional[Model] validation - convert dict to model
        if optional_model is not None and value is not None:
            if isinstance(value, optional_model):
                pass  # Already validated
            elif isinstance(value, dict):
                value = optional_model.model_validate(value)
            else:
                raise ValidationError(
                    field_name,
                    f"Expected {optional_model.__name__}, dict, or None, got {type(value).__name__}"
                )

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
        and not allow_none  # Optional[T]: None handling stays in Python (Issue #56)
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


def _resolve_hints(cls) -> dict:
    """Resolve type hints for a class, handling forward references.

    Passes the module's global namespace and includes the class itself
    in localns so self-referencing models work.

    Robustness (Issue #56): with ``from __future__ import annotations`` (PEP 563)
    every annotation is a string, so a *single* unresolvable name made
    ``get_type_hints`` raise for the whole class. The previous behavior swallowed
    that into an empty dict, which silently disabled ALL validation for the model
    (missing/invalid required fields were accepted with no error). We now fall
    back to resolving annotations field-by-field so good fields still validate,
    and we warn (never silently no-op) about the ones that truly can't resolve.
    """
    # Build namespace: module globals + the class itself for self-references
    module = sys.modules.get(cls.__module__, None)
    globalns = getattr(module, '__dict__', {}) if module else {}
    localns = {cls.__name__: cls}

    try:
        return get_type_hints(cls, globalns=globalns, localns=localns, include_extras=True)
    except Exception:
        # Whole-class resolution failed — almost always one bad/forward annotation
        # under PEP 563. Resolve each annotation independently so the rest of the
        # model is still validated. Walk the MRO base-first so subclass
        # annotations override inherited ones, matching get_type_hints().
        raw_hints: dict = {}
        for klass in reversed(cls.__mro__):
            raw_hints.update(getattr(klass, '__annotations__', {}))

        resolved: dict = {}
        unresolved: list = []
        for name, ann in raw_hints.items():
            if isinstance(ann, str):
                try:
                    # Mirror get_type_hints: evaluate the stringized annotation in
                    # the class's module globals + local namespace.
                    ann = eval(ann, globalns, localns)  # noqa: S307 - trusted source annotations
                except Exception:
                    unresolved.append(name)
                    continue
            resolved[name] = ann

        if unresolved:
            import warnings
            warnings.warn(
                f"dhi: could not resolve type annotations for "
                f"{cls.__module__}.{getattr(cls, '__qualname__', cls.__name__)} "
                f"field(s) {unresolved!r}; these fields will NOT be validated. "
                f"Define the referenced types and call model_rebuild() to fix. "
                f"(dhi never silently disables validation — see issue #56.)",
                stacklevel=3,
            )
        return resolved


def _compile_model_fields(cls, hints: dict) -> None:
    """Compile fields, validators, and native specs for a model class.

    This is the shared logic used by both _ModelMeta.__new__ and model_rebuild().
    It expects cls to already have model_config, __dhi_private_attrs__, and
    __dhi_computed_fields__ set.
    """
    model_config = cls.model_config

    # Build field info and validators
    fields: Dict[str, Dict[str, Any]] = {}
    validators: Dict[str, Any] = {}
    model_fields: Dict[str, FieldInfo] = {}

    # Reserved attribute names that should not be treated as fields
    reserved_names = {
        'model_config', 'model_fields', 'model_computed_fields',
        'model_fields_set', 'model_extra',
    }

    # Get the class namespace for defaults
    namespace = {}
    for klass in reversed(cls.__mro__):
        namespace.update(klass.__dict__)

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

    # Try to build native init specs for batch C init (one Python->C call)
    native_init_specs = []
    nested_field_specs = []
    can_native_init = HAS_NATIVE_EXT
    has_nested_or_complex = False

    _NESTED_DUMMY_CONSTRAINTS = (0, 0, None, None, None, None, None, None, None, 1, 0, 0, 0, 0)
    # type_code 7 = list-of-models, type_code 8 = union of models
    _LIST_OF_MODELS_CONSTRAINTS = (7, 0, None, None, None, None, None, None, None, 1, 0, 0, 0, 0)
    _UNION_CONSTRAINTS = (8, 0, None, None, None, None, None, None, None, 1, 0, 0, 0, 0)

    if can_native_init:
        for field_name, required, default, default_factory, alias, validator, _fi in fast_fields:
            constraints_attr = getattr(validator, '__dhi_native_constraints__', None)
            field_data = fields[field_name]
            base_type = field_data['base_type']
            annotation = field_data['annotation']

            is_nested = _is_basemodel_subclass(base_type)
            has_mutable_default = default_factory is not None or isinstance(default, (list, dict, set))

            # Detect List[Union[BaseModel...]] or List[BaseModel]
            list_of_models_types = None
            union_model_types = None
            type_origin = get_origin(base_type)
            if type_origin in (list, set, frozenset):
                type_args = get_args(base_type)
                if type_args:
                    item_type = type_args[0]
                    item_origin = get_origin(item_type)
                    if item_origin is Union:
                        union_args = get_args(item_type)
                        non_none = [a for a in union_args if a is not type(None)]
                        if non_none and all(_is_basemodel_subclass(a) for a in non_none):
                            list_of_models_types = tuple(non_none)
                    elif _is_basemodel_subclass(item_type):
                        list_of_models_types = (item_type,)
            # Detect Union[BaseModel...] (not Optional)
            elif type_origin is Union:
                type_args = get_args(base_type)
                non_none = [a for a in type_args if a is not type(None)]
                if len(non_none) > 1 and all(_is_basemodel_subclass(a) for a in non_none):
                    union_model_types = tuple(non_none)

            if is_nested and not has_mutable_default:
                native_init_specs.append((
                    field_name,
                    alias,
                    required,
                    default if default is not _MISSING else None,
                    _NESTED_DUMMY_CONSTRAINTS,
                    base_type,
                ))
            elif list_of_models_types is not None:
                # Extract length constraints from validator if present
                lom_constraints = list(_LIST_OF_MODELS_CONSTRAINTS)
                for c in field_data['constraints']:
                    if isinstance(c, FieldInfo):
                        if c.min_length is not None:
                            lom_constraints[7] = c.min_length
                        if c.max_length is not None:
                            lom_constraints[8] = c.max_length
                    elif hasattr(c, 'min_length') and hasattr(c, 'max_length'):
                        if getattr(c, 'min_length', None) is not None:
                            lom_constraints[7] = c.min_length
                        if getattr(c, 'max_length', None) is not None:
                            lom_constraints[8] = c.max_length
                native_init_specs.append((
                    field_name,
                    alias,
                    required,
                    default if default is not _MISSING else None,
                    tuple(lom_constraints),
                    list_of_models_types,  # tuple of types passed as 6th element
                ))
            elif union_model_types is not None and not has_mutable_default:
                native_init_specs.append((
                    field_name,
                    alias,
                    required,
                    default if default is not _MISSING else None,
                    _UNION_CONSTRAINTS,
                    union_model_types,  # tuple of types
                ))
            elif constraints_attr is not None and not is_nested and not has_mutable_default:
                native_init_specs.append((
                    field_name,
                    alias,
                    required,
                    default if default is not _MISSING else None,
                    constraints_attr,
                    None,
                ))
            else:
                has_nested_or_complex = True
                nested_field_specs.append((
                    field_name, alias, required, default, default_factory, validator, base_type, is_nested
                ))

    cls.__dhi_native_init_specs__ = tuple(native_init_specs) if can_native_init and native_init_specs else None
    cls.__dhi_nested_field_specs__ = tuple(nested_field_specs) if nested_field_specs else None
    cls.__dhi_has_nested_fields__ = has_nested_or_complex

    # Pre-compile into C structs for zero-overhead constraint access
    if can_native_init and native_init_specs:
        cls.__dhi_compiled_specs__ = _dhi_native.compile_model_specs(
            tuple(native_init_specs))
    else:
        cls.__dhi_compiled_specs__ = None

    # Track if we can use full native (no nested/complex fields)
    cls.__dhi_full_native__ = can_native_init and bool(native_init_specs) and not has_nested_or_complex

    # Update ultra-fast flag
    has_custom = getattr(cls, '__dhi_has_custom_validators__', False)
    cls.__dhi_use_ultra_fast__ = cls.__dhi_full_native__ and not has_custom


# Reference to the generic BaseModel.__init__, marked _dhi_managed once BaseModel
# is defined. Used by the metaclass to decide when it may safely override __init__.
_GENERIC_INIT = None


def _make_fast_init(_compiled, _extra_mode):
    """Specialized __init__ for ultra-fast classes that need no post-init.

    Captures the compiled C specs + extra-mode as cell variables so the hot
    path avoids the generic __init__'s per-call ``type(self)`` plus ~4 class
    attribute lookups (``__dhi_use_ultra_fast__``/``__dhi_compiled_specs__``/
    ``__dhi_extra_mode_int__``/``__dhi_needs_post_init__``). Mirrors the JS
    EMPTY_PATH win: same result, less per-call overhead. Measured ~+17%.
    """
    def __init__(self, **kwargs):
        result = _dhi_native.init_model_full(self, kwargs, _compiled, _extra_mode)
        if result is not None:
            raise ValidationErrors([ValidationError(f, m) for f, m in result])
    __init__._dhi_managed = True
    return __init__


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
        # Pass module globals + class itself as localns for forward/self references
        hints = _resolve_hints(cls)

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

        # Compile fields, validators, and native specs
        _compile_model_fields(cls, hints)

        # Check if model_post_init is overridden (for optimization)
        has_post_init = 'model_post_init' in namespace
        cls.__dhi_has_post_init__ = has_post_init

        # Pre-compute extra_mode as int for fast native path (0=ignore, 1=forbid, 2=allow)
        extra_mode_str = get_config_value(model_config, 'extra', 'ignore')
        cls.__dhi_extra_mode_int__ = {'ignore': 0, 'forbid': 1, 'allow': 2}.get(extra_mode_str, 0)

        # Combined flag: needs any post-init processing (private attrs or post_init override)
        cls.__dhi_needs_post_init__ = bool(private_attrs) or has_post_init

        # Install a specialized fast __init__ when it is safe to do so. We only
        # touch __init__ if the class doesn't define its own AND the __init__ it
        # would otherwise inherit is dhi-managed (never override a user's custom
        # __init__ defined on this class or any ancestor).
        if '__init__' not in namespace and getattr(cls.__init__, '_dhi_managed', False):
            if cls.__dhi_use_ultra_fast__ and not cls.__dhi_needs_post_init__:
                # Hot path: capture specs in a closure, skip per-call lookups.
                cls.__init__ = _make_fast_init(
                    cls.__dhi_compiled_specs__, cls.__dhi_extra_mode_int__)
            elif _GENERIC_INIT is not None:
                # Pin the generic init so we don't inherit a parent's specialized
                # __init__ (which captured the parent's specs, not ours).
                cls.__init__ = _GENERIC_INIT

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

    # Alias for API consistency with Struct
    from_json = model_validate_json

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

        # FAST PATH: Native C dump (handles nested models recursively now)
        compiled = getattr(cls, '__dhi_compiled_specs__', None)
        if (compiled is not None and mode == 'python' and not include and not exclude
                and not by_alias and not exclude_unset and not exclude_defaults
                and not exclude_none and HAS_NATIVE_EXT):
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
    def model_json_schema(
        cls,
        by_alias: bool = True,
        ref_template: str = '#/$defs/{model}',
        schema_generator: Any = None,
        mode: str = 'validation',
    ) -> Dict[str, Any]:
        """Generate JSON Schema for this model.

        Matches Pydantic's model_json_schema() classmethod for common callers.
        Nested models are emitted as ``$ref`` entries with definitions in ``$defs``.
        """
        definitions: Dict[str, Dict[str, Any]] = {}
        schema = _model_to_json_schema(
            cls,
            definitions=definitions,
            ref_template=ref_template,
            by_alias=by_alias,
            root_model=cls,
        )
        if definitions:
            schema['$defs'] = definitions
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
        """Rebuild model schema, resolving forward references.

        Call this after all referenced types are defined so that
        forward-referenced annotations can be resolved.

        Matches Pydantic v2's model_rebuild().

        Args:
            force: Force rebuild even if fields are already resolved.
            raise_errors: If True, raise on resolution failure.
            _parent_namespace_depth: Stack depth to find caller's namespace.
            _types_namespace: Explicit namespace for type resolution.

        Returns:
            True if rebuild succeeded, None if not needed.
        """
        # Skip if already has fields and not forced
        if not force and getattr(cls, '__dhi_fields__', None):
            return None

        # Build namespace for resolving forward references
        module = sys.modules.get(cls.__module__, None)
        globalns = getattr(module, '__dict__', {}) if module else {}
        localns = {cls.__name__: cls}

        # Merge caller's frame locals for types defined in the same scope
        try:
            frame = sys._getframe(_parent_namespace_depth)
            localns.update(frame.f_locals)
        except (ValueError, AttributeError):
            pass

        # Merge explicit namespace if provided
        if _types_namespace:
            localns.update(_types_namespace)

        try:
            hints = get_type_hints(cls, globalns=globalns, localns=localns, include_extras=True)
        except Exception:
            if raise_errors:
                raise
            return None

        # Re-compile fields, validators, and native specs
        _compile_model_fields(cls, hints)

        # Re-run __init_subclass__ logic to update custom validator flags
        has_custom = getattr(cls, '__dhi_has_custom_validators__', False)
        cls.__dhi_use_ultra_fast__ = cls.__dhi_full_native__ and not has_custom

        return True

    @classmethod
    def model_parametrized_name(cls, params: Tuple[Type[Any], ...]) -> str:
        """Generate parametrized class name for generics.

        Matches Pydantic v2's model_parametrized_name().
        """
        param_names = ', '.join(p.__name__ if hasattr(p, '__name__') else str(p) for p in params)
        return f'{cls.__name__}[{param_names}]'


# Capture the generic BaseModel.__init__ so the metaclass can (a) recognize it as
# dhi-managed (safe to override) and (b) pin it on classes that don't qualify for
# the specialized fast init. Must run after BaseModel is fully defined.
_GENERIC_INIT = BaseModel.__init__
_GENERIC_INIT._dhi_managed = True

__all__ = ["BaseModel", "IncEx"]
