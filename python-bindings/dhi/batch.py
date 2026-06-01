"""
High-performance batch validation API

This module provides batch validation functions that minimize FFI overhead
by validating multiple items in a single call to the native Zig library.
"""

from typing import List, Dict, Any, Tuple
import ctypes
from .validator import ValidationError, HAS_NATIVE_EXT

if HAS_NATIVE_EXT:
    try:
        from . import _dhi_native
    except ImportError:
        _dhi_native = None
else:
    _dhi_native = None


class BatchValidationResult:
    """Result of batch validation"""
    
    def __init__(self, results: List[bool], valid_count: int, total_count: int):
        self.results = results
        self.valid_count = valid_count
        self.total_count = total_count
        self.invalid_count = total_count - valid_count
    
    def is_all_valid(self) -> bool:
        """Check if all items are valid"""
        return self.valid_count == self.total_count
    
    def get_valid_indices(self) -> List[int]:
        """Get indices of valid items"""
        return [i for i, valid in enumerate(self.results) if valid]
    
    def get_invalid_indices(self) -> List[int]:
        """Get indices of invalid items"""
        return [i for i, valid in enumerate(self.results) if not valid]
    
    def __repr__(self) -> str:
        return f"BatchValidationResult(valid={self.valid_count}/{self.total_count})"


def validate_users_batch(
    users: List[Dict[str, Any]],
    name_min: int = 1,
    name_max: int = 100,
    age_min: int = 18,
    age_max: int = 120,
) -> BatchValidationResult:
    """
    Validate a batch of users in a single FFI call.
    
    This is significantly faster than validating each user individually
    because it makes only ONE call to the native library instead of
    3 calls per user (name, email, age).
    
    Args:
        users: List of user dictionaries with 'name', 'email', 'age' keys
        name_min: Minimum name length (default: 1)
        name_max: Maximum name length (default: 100)
        age_min: Minimum age (default: 18)
        age_max: Maximum age (default: 120)
    
    Returns:
        BatchValidationResult with validation results for each user
    
    Example:
        >>> users = [
        ...     {"name": "Alice", "email": "alice@example.com", "age": 25},
        ...     {"name": "Bob", "email": "bob@example.com", "age": 30},
        ... ]
        >>> result = validate_users_batch(users)
        >>> print(f"Valid: {result.valid_count}/{result.total_count}")
        Valid: 2/2
    """
    if not users:
        return BatchValidationResult([], 0, 0)
    
    count = len(users)
    
    # Use native extension if available
    if _dhi_native and hasattr(_dhi_native, 'validate_batch_direct'):
        # ULTRA-OPTIMIZED: Pass dicts directly to C with field specs
        # This eliminates ALL Python overhead - C extracts and validates directly!
        field_specs = {
            'name': ('string', name_min, name_max),
            'email': ('email',),
            'age': ('int', age_min, age_max),
        }
        results, valid_count = _dhi_native.validate_batch_direct(users, field_specs)
        return BatchValidationResult(results, valid_count, count)
    
    # Fallback: validate individually (slower)
    from .validator import BoundedString, Email, BoundedInt
    
    Name = BoundedString(name_min, name_max)
    Age = BoundedInt(age_min, age_max)
    
    results = []
    valid_count = 0
    
    for user in users:
        try:
            Name.validate(user.get('name', ''))
            Email.validate(user.get('email', ''))
            Age.validate(user.get('age', 0))
            results.append(True)
            valid_count += 1
        except ValidationError:
            results.append(False)
    
    return BatchValidationResult(results, valid_count, count)


def validate_ints_batch(
    values: List[int],
    min_val: int,
    max_val: int,
) -> BatchValidationResult:
    """
    Validate a batch of integers in a single FFI call.
    
    Args:
        values: List of integers to validate
        min_val: Minimum allowed value
        max_val: Maximum allowed value
    
    Returns:
        BatchValidationResult with validation results
    
    Example:
        >>> values = [25, 30, 150, 18, 90]
        >>> result = validate_ints_batch(values, 18, 90)
        >>> print(result.get_invalid_indices())  # [2] (150 is out of range)
        [2]
    """
    if not values:
        return BatchValidationResult([], 0, 0)
    
    count = len(values)
    
    # Use native extension if available
    if _dhi_native and hasattr(_dhi_native, 'validate_int_range_batch_direct'):
        results, valid_count = _dhi_native.validate_int_range_batch_direct(
            values, min_val, max_val
        )
        return BatchValidationResult(results, valid_count, count)
    if _dhi_native and hasattr(_dhi_native, 'validate_int_batch_simd'):
        results, valid_count = _dhi_native.validate_int_batch_simd(
            values, min_val, max_val
        )
        return BatchValidationResult(results, valid_count, count)
    
    # Fallback
    results = [min_val <= v <= max_val for v in values]
    valid_count = sum(results)
    return BatchValidationResult(results, valid_count, count)


def validate_strings_batch(
    strings: List[str],
    min_len: int,
    max_len: int,
) -> BatchValidationResult:
    """
    Validate a batch of string lengths in a single FFI call.
    
    Args:
        strings: List of strings to validate
        min_len: Minimum allowed length
        max_len: Maximum allowed length
    
    Returns:
        BatchValidationResult with validation results
    """
    if not strings:
        return BatchValidationResult([], 0, 0)
    
    count = len(strings)
    
    # Use native extension if available
    if _dhi_native and hasattr(_dhi_native, 'validate_string_length_batch_direct'):
        # Zero-encode fast path: native reads char length straight off each str
        # (no UTF-8 encoding, no throwaway bytes objects).
        results, valid_count = _dhi_native.validate_string_length_batch_direct(
            strings, min_len, max_len
        )
        return BatchValidationResult(results, valid_count, count)
    if _dhi_native and hasattr(_dhi_native, 'validate_string_length_batch'):
        encoded = [s.encode('utf-8') for s in strings]
        results, valid_count = _dhi_native.validate_string_length_batch(
            encoded, min_len, max_len
        )
        return BatchValidationResult(results, valid_count, count)
    
    # Fallback
    results = [min_len <= len(s) <= max_len for s in strings]
    valid_count = sum(results)
    return BatchValidationResult(results, valid_count, count)


def validate_emails_batch(emails: List[str]) -> BatchValidationResult:
    """
    Validate a batch of email addresses in a single FFI call.
    
    Args:
        emails: List of email addresses to validate
    
    Returns:
        BatchValidationResult with validation results
    """
    if not emails:
        return BatchValidationResult([], 0, 0)
    
    count = len(emails)
    
    # Use native extension if available
    if _dhi_native and hasattr(_dhi_native, 'validate_email_batch'):
        encoded = [e.encode('utf-8') for e in emails]
        results, valid_count = _dhi_native.validate_email_batch(encoded)
        return BatchValidationResult(results, valid_count, count)
    
    # Fallback
    from .validator import Email
    results = []
    valid_count = 0
    
    for email in emails:
        try:
            Email.validate(email)
            results.append(True)
            valid_count += 1
        except ValidationError:
            results.append(False)
    
    return BatchValidationResult(results, valid_count, count)


__all__ = [
    'BatchValidationResult',
    'validate_users_batch',
    'validate_ints_batch',
    'validate_strings_batch',
    'validate_emails_batch',
]
