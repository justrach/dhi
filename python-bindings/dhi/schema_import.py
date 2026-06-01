"""JSON Schema import — "define once, hydrate anywhere" (Issue #55, Proposal B).

The inverse of ``BaseModel.model_json_schema()``: build a dhi ``BaseModel``
subclass from a JSON Schema document so a single schema (e.g. a shared
``*.schema.json``) can drive both the Python and TypeScript bindings
identically.

    from dhi import from_json_schema

    ChatRequest = from_json_schema({
        "title": "ChatRequest",
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "minLength": 1},
            "model": {"type": "string"},
        },
        "required": ["prompt"],
    })

    ChatRequest(prompt="hi")  # validates like any other dhi BaseModel
"""
from typing import Annotated, Any, Dict, List, Optional

from .fields import Field
from .model import BaseModel

__all__ = ["from_json_schema", "load_schema"]

# JSON Schema keyword -> dhi Field() kwarg.
_NUMERIC_KEYWORDS = {
    "minimum": "ge",
    "maximum": "le",
    "exclusiveMinimum": "gt",
    "exclusiveMaximum": "lt",
    "multipleOf": "multiple_of",
}
_STRING_KEYWORDS = {
    "minLength": "min_length",
    "maxLength": "max_length",
    "pattern": "pattern",
}
_ARRAY_KEYWORDS = {
    "minItems": "min_length",
    "maxItems": "max_length",
}

_TYPE_MAP = {
    "string": str,
    "integer": int,
    "number": float,
    "boolean": bool,
    "null": type(None),
}


def _deref(node: Any, root: Dict[str, Any]) -> Any:
    """Resolve a local ``$ref`` (``#/$defs/Foo``) against the root document."""
    if not isinstance(node, dict) or "$ref" not in node:
        return node
    ref = node["$ref"]
    if not isinstance(ref, str) or not ref.startswith("#"):
        raise ValueError(
            f"from_json_schema: only local $ref (starting with '#') are supported, got {ref!r}"
        )
    target: Any = root
    for part in ref.lstrip("#").split("/"):
        if not part:
            continue
        part = part.replace("~1", "/").replace("~0", "~")
        if not isinstance(target, dict) or part not in target:
            raise ValueError(f"from_json_schema: could not resolve $ref {ref!r}")
        target = target[part]
    return target


def _is_nullable(schema: Dict[str, Any], root: Dict[str, Any]) -> bool:
    t = schema.get("type")
    if isinstance(t, list) and "null" in t:
        return True
    if schema.get("nullable") is True:  # OpenAPI 3.0
        return True
    for key in ("anyOf", "oneOf"):
        variants = schema.get(key)
        if isinstance(variants, list):
            for v in variants:
                if _deref(v, root).get("type") == "null":
                    return True
    return False


def _enum_validator(allowed: List[Any]):
    allowed_list = list(allowed)

    def _check(value: Any) -> Any:
        if value not in allowed_list:
            raise ValueError(f"value must be one of {allowed_list!r}, got {value!r}")
        return value

    return _check


def _const_validator(expected: Any):
    def _check(value: Any) -> Any:
        if value != expected:
            raise ValueError(f"value must equal {expected!r}, got {value!r}")
        return value

    return _check


def _python_type(field_name, schema, root, parent_title, depth):
    """Return (python_type, [extra_validators]) for a property schema."""
    schema = _deref(schema, root)

    if "enum" in schema and isinstance(schema["enum"], list) and schema["enum"]:
        vals = schema["enum"]
        base = type(vals[0]) if all(type(v) is type(vals[0]) for v in vals) else object
        return base, [_enum_validator(vals)]

    if "const" in schema:
        cv = schema["const"]
        return type(cv), [_const_validator(cv)]

    # anyOf/oneOf: collapse the common "X or null" pattern; otherwise treat as Any.
    for key in ("anyOf", "oneOf"):
        variants = schema.get(key)
        if isinstance(variants, list):
            non_null = [v for v in variants if _deref(v, root).get("type") != "null"]
            if len(non_null) == 1:
                return _python_type(field_name, non_null[0], root, parent_title, depth)
            return object, []

    t = schema.get("type")
    if isinstance(t, list):
        non_null = [x for x in t if x != "null"]
        t = non_null[0] if len(non_null) == 1 else None

    if t == "array":
        items = schema.get("items")
        if isinstance(items, dict):
            item_type, _ = _python_type(field_name + "_item", items, root, parent_title, depth)
            return List[item_type], []
        return list, []

    if t == "object" or "properties" in schema:
        sub_name = schema.get("title") or f"{parent_title}_{field_name}"
        sub_model = from_json_schema(schema, name=sub_name, _root=root, _depth=depth + 1)
        return sub_model, []

    return _TYPE_MAP.get(t, object), []


def _field_kwargs(schema: Dict[str, Any]) -> Dict[str, Any]:
    kwargs: Dict[str, Any] = {}
    for js_key, fld_key in _NUMERIC_KEYWORDS.items():
        if js_key in schema:
            kwargs[fld_key] = schema[js_key]
    for js_key, fld_key in _STRING_KEYWORDS.items():
        if js_key in schema:
            kwargs[fld_key] = schema[js_key]
    for js_key, fld_key in _ARRAY_KEYWORDS.items():
        if js_key in schema:
            kwargs[fld_key] = schema[js_key]
    if isinstance(schema.get("description"), str):
        kwargs["description"] = schema["description"]
    if isinstance(schema.get("title"), str):
        kwargs["title"] = schema["title"]
    return kwargs


def from_json_schema(
    doc: Dict[str, Any],
    *,
    name: Optional[str] = None,
    _root: Optional[Dict[str, Any]] = None,
    _depth: int = 0,
) -> type:
    """Build a dhi ``BaseModel`` subclass from a JSON Schema document.

    The inverse of ``BaseModel.model_json_schema()``. Supports object/array/
    string/number/integer/boolean properties, ``enum``/``const``, the common
    ``anyOf``/``oneOf`` "X or null" nullable pattern, local ``$ref``
    (``#/$defs/...``), and the same string/number/array constraints dhi emits.

    Args:
        doc: The JSON Schema document (an object schema).
        name: Optional class name (defaults to the schema ``title`` or
            ``"DhiSchema"``).

    Returns:
        A new ``BaseModel`` subclass that validates like any hand-written model.
    """
    root = _root if _root is not None else doc
    doc = _deref(doc, root)

    title = name or doc.get("title") or "DhiSchema"
    properties = doc.get("properties", {}) or {}
    required = set(doc.get("required", []) or [])

    annotations: Dict[str, Any] = {}
    namespace: Dict[str, Any] = {"__annotations__": annotations}

    for field_name, prop in properties.items():
        prop = _deref(prop, root)
        base_type, extra_validators = _python_type(field_name, prop, root, title, _depth)

        is_optional = field_name not in required
        nullable = is_optional or _is_nullable(prop, root)

        inner = Optional[base_type] if nullable else base_type

        metadata: List[Any] = []
        kwargs = _field_kwargs(prop)
        if kwargs:
            metadata.append(Field(**kwargs))
        metadata.extend(extra_validators)

        annotation = Annotated[(inner, *metadata)] if metadata else inner
        annotations[field_name] = annotation

        # Defaults: explicit default wins; otherwise optional fields default to None.
        if "default" in prop:
            namespace[field_name] = prop["default"]
        elif is_optional:
            namespace[field_name] = None

    return type(str(title), (BaseModel,), namespace)


# Pydantic-style alias.
load_schema = from_json_schema
