"""Tests for JSON Schema import (Issue #55, Proposal B): from_json_schema().

A schema document can be hydrated into a dhi BaseModel that validates
identically to a hand-written model — enabling define-once schemas shared
across the Python and TS bindings.
"""
import pytest

from dhi import BaseModel, Field, from_json_schema, load_schema
from dhi.validator import ValidationErrors


def test_basic_object():
    Model = from_json_schema(
        {
            "title": "User",
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 1, "maxLength": 100},
                "age": {"type": "integer", "minimum": 0, "maximum": 150},
            },
            "required": ["name", "age"],
        }
    )
    assert Model.__name__ == "User"
    m = Model(name="Alice", age=30)
    assert m.name == "Alice"
    assert m.age == 30


def test_required_enforced():
    Model = from_json_schema(
        {"type": "object", "properties": {"x": {"type": "integer"}}, "required": ["x"]}
    )
    with pytest.raises(ValidationErrors):
        Model()


def test_string_constraints():
    Model = from_json_schema(
        {
            "type": "object",
            "properties": {"name": {"type": "string", "minLength": 2, "maxLength": 4}},
            "required": ["name"],
        }
    )
    Model(name="abc")
    with pytest.raises(ValidationErrors):
        Model(name="a")
    with pytest.raises(ValidationErrors):
        Model(name="abcde")


def test_numeric_constraints():
    Model = from_json_schema(
        {
            "type": "object",
            "properties": {
                "n": {"type": "integer", "exclusiveMinimum": 0, "maximum": 10},
            },
            "required": ["n"],
        }
    )
    Model(n=5)
    with pytest.raises(ValidationErrors):
        Model(n=0)  # exclusive
    with pytest.raises(ValidationErrors):
        Model(n=11)


def test_optional_field():
    Model = from_json_schema(
        {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "nickname": {"type": "string"},
            },
            "required": ["name"],
        }
    )
    m = Model(name="bob")
    assert m.nickname is None
    # optional but wrong type still rejected
    with pytest.raises(ValidationErrors):
        Model(name="bob", nickname=123)


def test_nullable_type_array():
    Model = from_json_schema(
        {
            "type": "object",
            "properties": {"bio": {"type": ["string", "null"]}},
            "required": ["bio"],
        }
    )
    assert Model(bio=None).bio is None
    assert Model(bio="hi").bio == "hi"
    with pytest.raises(ValidationErrors):
        Model(bio=123)


def test_enum_enforced():
    Model = from_json_schema(
        {
            "type": "object",
            "properties": {"role": {"enum": ["admin", "user", "guest"]}},
            "required": ["role"],
        }
    )
    Model(role="admin")
    with pytest.raises(Exception):
        Model(role="wizard")


def test_array_of_strings():
    Model = from_json_schema(
        {
            "type": "object",
            "properties": {
                "tags": {"type": "array", "items": {"type": "string"}, "minItems": 1},
            },
            "required": ["tags"],
        }
    )
    assert Model(tags=["a", "b"]).tags == ["a", "b"]
    with pytest.raises(ValidationErrors):
        Model(tags=[])  # minItems
    with pytest.raises(ValidationErrors):
        Model(tags=[1, 2])  # wrong item type


def test_nested_object():
    Model = from_json_schema(
        {
            "type": "object",
            "properties": {
                "user": {
                    "type": "object",
                    "properties": {"id": {"type": "integer"}},
                    "required": ["id"],
                }
            },
            "required": ["user"],
        }
    )
    m = Model(user={"id": 1})
    assert m.user.id == 1
    with pytest.raises(ValidationErrors):
        Model(user={"id": "nope"})


def test_ref_resolution():
    Model = from_json_schema(
        {
            "type": "object",
            "properties": {"user": {"$ref": "#/$defs/User"}},
            "required": ["user"],
            "$defs": {
                "User": {
                    "type": "object",
                    "properties": {"id": {"type": "integer"}},
                    "required": ["id"],
                }
            },
        }
    )
    assert Model(user={"id": 7}).user.id == 7
    with pytest.raises(ValidationErrors):
        Model(user={"id": "x"})


def test_default_value():
    Model = from_json_schema(
        {
            "type": "object",
            "properties": {"limit": {"type": "integer", "default": 10}},
        }
    )
    assert Model().limit == 10
    assert Model(limit=5).limit == 5


def test_load_schema_alias():
    assert load_schema is from_json_schema


def test_round_trip_from_model_json_schema():
    """A model -> model_json_schema() -> from_json_schema() validates the same."""
    from typing import Annotated

    class Original(BaseModel):
        name: Annotated[str, Field(min_length=1)]
        count: Annotated[int, Field(ge=0)]

    doc = Original.model_json_schema()
    Rebuilt = from_json_schema(doc, name="Rebuilt")

    Rebuilt(name="x", count=3)
    with pytest.raises(ValidationErrors):
        Rebuilt(name="", count=3)
    with pytest.raises(ValidationErrors):
        Rebuilt(name="x", count=-1)
