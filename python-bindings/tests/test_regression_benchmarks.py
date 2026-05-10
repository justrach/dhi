"""
Regression tests for dhi validation performance.

These tests ensure that core validation throughput doesn't regress
below established baselines. The thresholds are set conservatively
(50% of measured peaks) to avoid flaky failures on different hardware,
while still catching major regressions.

Baseline measured on Apple Silicon (M-series), March 2026:
  - Batch validation: ~24M users/sec
  - Single item validation: ~200K items/sec
"""

import time
import pytest
from dhi import _dhi_native
from dhi.batch import validate_ints_batch


def generate_users(n: int):
    return [
        {
            "name": f"User{i}",
            "email": f"user{i}@example.com",
            "age": 20 + (i % 50),
            "website": f"https://user{i}.com",
        }
        for i in range(n)
    ]


FIELD_SPECS = {
    "name": ("string", 1, 100),
    "email": ("email",),
    "age": ("int_positive",),
    "website": ("url",),
}


class TestBatchValidationRegression:
    """Ensure batch validation throughput stays above baseline."""

    def test_batch_10k_minimum_throughput(self):
        """10K users should validate at >5M users/sec (conservative floor)."""
        users = generate_users(10_000)

        # Warmup
        _dhi_native.validate_batch_direct(users, FIELD_SPECS)

        # Measure
        start = time.perf_counter()
        results, valid_count = _dhi_native.validate_batch_direct(users, FIELD_SPECS)
        elapsed = time.perf_counter() - start

        throughput = len(users) / elapsed
        assert valid_count == 10_000, f"Expected all valid, got {valid_count}"
        assert throughput > 5_000_000, (
            f"Batch throughput regressed: {throughput:,.0f} users/sec "
            f"(minimum: 5,000,000 users/sec)"
        )

    def test_batch_1k_minimum_throughput(self):
        """1K users should validate at >2M users/sec."""
        users = generate_users(1_000)

        # Warmup
        _dhi_native.validate_batch_direct(users, FIELD_SPECS)

        start = time.perf_counter()
        results, valid_count = _dhi_native.validate_batch_direct(users, FIELD_SPECS)
        elapsed = time.perf_counter() - start

        throughput = len(users) / elapsed
        assert valid_count == 1_000
        assert throughput > 2_000_000, (
            f"Batch throughput regressed: {throughput:,.0f} users/sec "
            f"(minimum: 2,000,000 users/sec)"
        )


class TestValidationCorrectness:
    """Ensure validators produce correct results after rename."""

    def test_valid_user_passes(self):
        users = [{"name": "Alice", "email": "alice@example.com", "age": 25, "website": "https://example.com"}]
        results, valid_count = _dhi_native.validate_batch_direct(users, FIELD_SPECS)
        assert valid_count == 1

    def test_invalid_email_fails(self):
        users = [{"name": "Alice", "email": "not-an-email", "age": 25, "website": "https://example.com"}]
        results, valid_count = _dhi_native.validate_batch_direct(users, FIELD_SPECS)
        assert valid_count == 0

    def test_negative_age_fails(self):
        users = [{"name": "Alice", "email": "alice@example.com", "age": -1, "website": "https://example.com"}]
        results, valid_count = _dhi_native.validate_batch_direct(users, FIELD_SPECS)
        assert valid_count == 0

    def test_empty_name_fails(self):
        users = [{"name": "", "email": "alice@example.com", "age": 25, "website": "https://example.com"}]
        results, valid_count = _dhi_native.validate_batch_direct(users, FIELD_SPECS)
        assert valid_count == 0

    def test_invalid_url_fails(self):
        users = [{"name": "Alice", "email": "alice@example.com", "age": 25, "website": "not-a-url"}]
        results, valid_count = _dhi_native.validate_batch_direct(users, FIELD_SPECS)
        assert valid_count == 0

    def test_batch_mixed_valid_invalid(self):
        users = [
            {"name": "Alice", "email": "alice@example.com", "age": 25, "website": "https://a.com"},
            {"name": "", "email": "bad", "age": -1, "website": "nope"},
            {"name": "Bob", "email": "bob@test.org", "age": 30, "website": "https://b.com"},
        ]
        results, valid_count = _dhi_native.validate_batch_direct(users, FIELD_SPECS)
        assert valid_count == 2

    def test_batch_invalid_int_type_fails_without_leaking_python_error(self):
        users = [{"age": "bad"}]
        for spec in [
            ("int", 0, 100),
            ("int_gt", 0),
            ("int_gte", 0),
            ("int_lt", 0),
            ("int_lte", 0),
            ("int_positive",),
            ("int_non_negative",),
            ("int_multiple_of", 2),
        ]:
            results, valid_count = _dhi_native.validate_batch_direct(users, {"age": spec})
            assert results == [False]
            assert valid_count == 0


class TestIntRangeBatchDirect:
    """Ensure the native direct integer-list batch API works and is wired into Python."""

    def test_direct_int_range_batch_mixed_values(self):
        results, valid_count = _dhi_native.validate_int_range_batch_direct(
            [18, 25, 90, 17, 91, "bad"], 18, 90
        )
        assert results == [True, True, True, False, False, False]
        assert valid_count == 3

    def test_validate_ints_batch_uses_direct_native_path(self):
        result = validate_ints_batch([1, 5, 10, 11], 1, 10)
        assert result.results == [True, True, True, False]
        assert result.valid_count == 3
        assert result.invalid_count == 1
