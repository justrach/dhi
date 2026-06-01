"""Regression tests for issues #57 and #58.

#57 — a fractional float for an int field must be rejected (not silently
      truncated). Whole-valued floats (5.0 -> 5) are still accepted.
#58 — the native extension declares free-thread support, so importing dhi on a
      free-threaded (cp313t/cp314t) interpreter does not re-enable the GIL.
"""
import subprocess
import sys

import pytest

from typing import Optional

from dhi import BaseModel
from dhi.validator import ValidationErrors, HAS_NATIVE_EXT


# ---------------------------------------------------------------------------
# #57 — fractional float -> int must be rejected
# ---------------------------------------------------------------------------

class _M(BaseModel):
    x: int


def test_plain_int_rejects_fractional_float():
    with pytest.raises(ValidationErrors):
        _M(x=1.5)


def test_plain_int_accepts_whole_float():
    assert _M(x=5.0).x == 5
    assert isinstance(_M(x=5.0).x, int)


def test_plain_int_accepts_int():
    assert _M(x=7).x == 7


def test_no_silent_truncation_via_model_dump():
    # The exact issue repro: M(x=1.5).model_dump() must not yield {'x': 1}.
    with pytest.raises(ValidationErrors):
        _M(x=1.5).model_dump()


def test_optional_int_rejects_fractional_float():
    # codegraff scenario: max_tokens: Optional[int] = None
    class C(BaseModel):
        max_tokens: Optional[int] = None

    assert C(max_tokens=8000).max_tokens == 8000
    assert C(max_tokens=None).max_tokens is None
    assert C(max_tokens=8000.0).max_tokens == 8000  # whole float ok
    with pytest.raises(ValidationErrors):
        C(max_tokens=1.5)


def test_multifield_batch_path_rejects_fractional_float():
    # Multiple fields exercise the compiled/batch native init path.
    class Multi(BaseModel):
        a: int
        b: int
        c: int

    Multi(a=1, b=2, c=3)
    with pytest.raises(ValidationErrors):
        Multi(a=1, b=2.5, c=3)


def test_non_integral_specials_rejected():
    for bad in (float("inf"), float("nan")):
        with pytest.raises(ValidationErrors):
            _M(x=bad)


# ---------------------------------------------------------------------------
# #58 — free-threaded import must not re-enable the GIL
# ---------------------------------------------------------------------------

_is_freethreaded = hasattr(sys, "_is_gil_enabled") and not sys._is_gil_enabled()


@pytest.mark.skipif(
    not (_is_freethreaded and HAS_NATIVE_EXT),
    reason="only meaningful on a free-threaded build with the native extension",
)
def test_import_does_not_reenable_gil():
    # Run in a fresh interpreter so we observe the import side-effect cleanly.
    code = (
        "import sys; "
        "assert not sys._is_gil_enabled(), 'GIL already on before import'; "
        "import dhi; "
        "import sys as _s; "
        "print('GIL_AFTER', _s._is_gil_enabled())"
    )
    proc = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr
    assert "GIL_AFTER False" in proc.stdout, (proc.stdout, proc.stderr)
    # And the surprise RuntimeWarning must be gone.
    assert "enabled to load module" not in proc.stderr
