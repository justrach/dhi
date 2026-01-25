"""
ConfigDict for dhi - Pydantic v2 compatible model configuration.

Provides ConfigDict TypedDict for configuring BaseModel behavior,
matching Pydantic's model_config API exactly.

Example:
    from dhi import BaseModel, ConfigDict

    class User(BaseModel):
        model_config = ConfigDict(
            strict=True,
            frozen=True,
            extra='forbid',
        )
        name: str
        age: int
"""

from typing import Any, Callable, Dict, Literal, Optional, Pattern, Tuple, Type, Union

try:
    from typing import TypedDict
except ImportError:
    from typing_extensions import TypedDict


class ConfigDict(TypedDict, total=False):
    """Configuration dictionary for BaseModel.

    Matches Pydantic v2's ConfigDict exactly.
    """

    # Validation behavior
    strict: bool
    """If True, strict validation is applied to all fields. Default: False."""

    extra: Literal['allow', 'ignore', 'forbid']
    """How to handle extra fields. Default: 'ignore'.
    - 'allow': Extra fields are allowed and stored in model_extra.
    - 'ignore': Extra fields are silently ignored.
    - 'forbid': Extra fields raise a validation error.
    """

    frozen: bool
    """If True, model instances are immutable. Default: False."""

    populate_by_name: bool
    """If True, allow populating fields by name in addition to alias. Default: False."""

    use_enum_values: bool
    """If True, populate model with enum values instead of enum instances. Default: False."""

    validate_assignment: bool
    """If True, validate values on attribute assignment. Default: False."""

    arbitrary_types_allowed: bool
    """If True, allow arbitrary types in fields. Default: False."""

    from_attributes: bool
    """If True, allow extracting data from object attributes (ORM mode). Default: False."""

    loc_by_alias: bool
    """If True, use alias in error locations. Default: True."""

    alias_generator: Optional[Callable[[str], str]]
    """Callable to generate aliases from field names. Default: None."""

    model_title_generator: Optional[Callable[[Type], str]]
    """Callable to generate model title. Default: None."""

    field_title_generator: Optional[Callable[[str, Any], str]]
    """Callable to generate field titles. Default: None."""

    validate_default: bool
    """If True, validate default values. Default: False."""

    validate_return: bool
    """If True, validate return values from call validators. Default: False."""

    protected_namespaces: Tuple[str, ...]
    """Protected namespace prefixes. Default: ('model_',)."""

    hide_input_in_errors: bool
    """If True, hide input data in validation errors. Default: False."""

    defer_build: bool
    """If True, defer model schema building. Default: False."""

    plugin_settings: Optional[Dict[str, Any]]
    """Settings for plugins. Default: None."""

    coerce_numbers_to_str: bool
    """If True, coerce numbers to strings. Default: False."""

    regex_engine: Literal['rust-regex', 'python-re']
    """Regex engine to use. Default: 'python-re' (dhi uses Python re)."""

    validation_error_cause: bool
    """If True, include cause in validation errors. Default: False."""

    use_attribute_docstrings: bool
    """If True, use attribute docstrings for descriptions. Default: False."""

    cache_strings: Union[bool, Literal['all', 'keys', 'none']]
    """String caching mode. Default: True."""

    # String processing
    str_strip_whitespace: bool
    """If True, strip whitespace from all strings. Default: False."""

    str_to_lower: bool
    """If True, convert all strings to lowercase. Default: False."""

    str_to_upper: bool
    """If True, convert all strings to uppercase. Default: False."""

    str_min_length: Optional[int]
    """Minimum length for all strings. Default: None."""

    str_max_length: Optional[int]
    """Maximum length for all strings. Default: None."""

    # JSON Schema
    title: Optional[str]
    """Title for JSON schema. Default: class name."""

    json_schema_extra: Optional[Union[Dict[str, Any], Callable[[Dict[str, Any]], None]]]
    """Extra properties for JSON schema. Default: None."""

    # Serialization
    ser_json_timedelta: Literal['iso8601', 'float']
    """How to serialize timedelta. Default: 'iso8601'."""

    ser_json_bytes: Literal['utf8', 'base64', 'hex']
    """How to serialize bytes. Default: 'utf8'."""

    ser_json_inf_nan: Literal['null', 'constants', 'strings']
    """How to serialize inf/nan. Default: 'null'."""

    # Revalidation
    revalidate_instances: Literal['always', 'never', 'subclass-instances']
    """When to revalidate model instances. Default: 'never'."""


# Default configuration values
CONFIG_DEFAULTS: ConfigDict = {
    'strict': False,
    'extra': 'ignore',
    'frozen': False,
    'populate_by_name': False,
    'use_enum_values': False,
    'validate_assignment': False,
    'arbitrary_types_allowed': False,
    'from_attributes': False,
    'loc_by_alias': True,
    'validate_default': False,
    'validate_return': False,
    'protected_namespaces': ('model_',),
    'hide_input_in_errors': False,
    'defer_build': False,
    'coerce_numbers_to_str': False,
    'regex_engine': 'python-re',
    'validation_error_cause': False,
    'use_attribute_docstrings': False,
    'cache_strings': True,
    'str_strip_whitespace': False,
    'str_to_lower': False,
    'str_to_upper': False,
    'revalidate_instances': 'never',
}


def get_config_value(config: Optional[ConfigDict], key: str, default: Any = None) -> Any:
    """Get a configuration value with fallback to defaults."""
    if config is None:
        return CONFIG_DEFAULTS.get(key, default)
    return config.get(key, CONFIG_DEFAULTS.get(key, default))


__all__ = ["ConfigDict", "CONFIG_DEFAULTS", "get_config_value"]
