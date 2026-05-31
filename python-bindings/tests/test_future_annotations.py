"""Regression tests for PEP 563 (`from __future__ import annotations`) support.

Issue #56: with stringized annotations, `_resolve_hints` used to swallow any
resolution failure into an empty dict, which silently disabled ALL validation
for the model — missing/invalid required fields were accepted with no error.

The whole point of these tests is that this module has
`from __future__ import annotations` at the top, so every annotation below is a
string that must be resolved at class-creation time.
"""
from __future__ import annotations

import warnings

import pytest

from dhi import BaseModel
from dhi.validator import ValidationErrors


class Config(BaseModel):
    name: str
    age: int
    tags: list[str] = []


def test_required_fields_enforced_under_future_annotations():
    """Missing required fields must still raise (not silently pass)."""
    with pytest.raises(ValidationErrors):
        Config()


def test_type_checking_under_future_annotations():
    """Invalid types must still be rejected with stringized annotations."""
    with pytest.raises(ValidationErrors):
        Config(name=123, age="not-an-int")


def test_valid_construction_under_future_annotations():
    cfg = Config(name="alice", age=30, tags=["a", "b"])
    assert cfg.name == "alice"
    assert cfg.age == 30
    assert cfg.tags == ["a", "b"]


def test_unresolvable_annotation_warns_and_keeps_other_fields():
    """An annotation that can't be resolved must warn (never silently no-op),
    while the rest of the model still validates. (Issue #56)"""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")

        class Partial(BaseModel):
            name: str
            thing: ThisTypeDoesNotExistAnywhere  # noqa: F821 - intentional

        messages = [str(w.message) for w in caught
                    if "could not resolve" in str(w.message)]
        assert messages, "expected a warning about the unresolvable annotation"

    # The good field is still validated despite the broken sibling.
    with pytest.raises(ValidationErrors):
        Partial(name=123)
    assert Partial(name="ok").name == "ok"
