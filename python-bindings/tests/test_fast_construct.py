"""Tests for the C vectorcall construction fast path.

These exercise construction behavior that must be identical whether the
class goes through the C vectorcall fast path (CPython >= 3.12 with the
native extension), the specialized fast __init__, or the pure-Python
fallback.
"""

import copy
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from dhi import BaseModel, Field, ConfigDict, ValidationError, ValidationErrors

try:
    from dhi import _dhi_native
except ImportError:
    _dhi_native = None


class TestFastConstruct:
    def test_basic_construction_kwargs_and_splat(self):
        class User(BaseModel):
            name: str
            age: int

        u1 = User(name="Alice", age=30)
        u2 = User(**{"name": "Alice", "age": 30})
        assert u1 == u2
        assert u1.model_dump() == {"name": "Alice", "age": 30}
        assert u1.model_fields_set == {"name", "age"}

    def test_positional_args_rejected(self):
        class M(BaseModel):
            x: int

        with pytest.raises(TypeError):
            M(1)

    def test_validation_error_type_and_fields(self):
        class M(BaseModel):
            x: int
            y: str

        with pytest.raises(ValidationErrors):
            M(x="not an int", y="ok")
        with pytest.raises(ValidationErrors):
            M(y="missing x")

    def test_extra_forbid_and_allow(self):
        class Forbid(BaseModel):
            model_config = ConfigDict(extra='forbid')
            x: int

        with pytest.raises(ValidationErrors):
            Forbid(x=1, y=2)

        class Allow(BaseModel):
            model_config = ConfigDict(extra='allow')
            x: int

        a = Allow(x=1, y=2)
        assert a.model_extra == {"y": 2}

    def test_defaults_and_fields_set(self):
        class M(BaseModel):
            x: int
            y: str = "hi"

        m = M(x=1)
        assert m.y == "hi"
        assert m.model_fields_set == {"x"}

    def test_custom_init_not_bypassed(self):
        class Custom(BaseModel):
            x: int

            def __init__(self, **kw):
                kw['x'] = kw.get('x', 0) + 100
                super().__init__(**kw)

        assert Custom(x=1).x == 101
        # fast construct must not be installed when __init__ is custom
        assert '__dhi_fast_construct__' not in Custom.__dict__

    def test_model_post_init_not_bypassed(self):
        class PostInit(BaseModel):
            x: int

            def model_post_init(self, ctx):
                self.__dict__['x'] = self.x * 2

        assert PostInit(x=3).x == 6
        assert '__dhi_fast_construct__' not in PostInit.__dict__

    def test_model_validate_fast_path(self):
        class M(BaseModel):
            x: int
            y: str

        m = M.model_validate({"x": 1, "y": "a"})
        assert m.x == 1 and m.y == "a"
        assert m.model_fields_set == {"x", "y"}
        # instance passthrough still works
        assert M.model_validate(m) is m
        with pytest.raises(ValidationErrors):
            M.model_validate({"x": "bad", "y": "a"})
        with pytest.raises((ValidationError, ValidationErrors)):
            M.model_validate("not a dict")

    def test_copy_and_equality(self):
        class M(BaseModel):
            x: int

        m = M(x=5)
        assert copy.deepcopy(m).x == 5
        assert m.model_copy() == m
        assert M(x=5) == m

    @pytest.mark.skipif(_dhi_native is None, reason="native extension not available")
    def test_disable_fast_construct_falls_back(self):
        class M(BaseModel):
            x: int

        if '__dhi_fast_construct__' not in M.__dict__:
            pytest.skip("fast construct not enabled on this build")
        _dhi_native.disable_fast_construct(M)
        assert '__dhi_fast_construct__' not in M.__dict__
        m = M(x=7)  # falls back to the Python fast __init__
        assert m.x == 7
        with pytest.raises(ValidationErrors):
            M(x="bad")
