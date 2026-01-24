"""
Core validation classes for dhi
"""

import ctypes
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

# Try to import native extension first (fastest)
try:
    from . import _dhi_native
    HAS_NATIVE_EXT = True
except ImportError:
    HAS_NATIVE_EXT = False
    _dhi_native = None


class ValidationError(Exception):
    """Single validation error"""
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")


class ValidationErrors(Exception):
    """Multiple validation errors"""
    def __init__(self, errors: List[ValidationError]):
        self.errors = errors
        messages = "\n".join(str(e) for e in errors)
        super().__init__(f"Validation failed:\n{messages}")


class BoundedInt:
    """Integer with min/max bounds validation"""
    
    def __init__(self, min_val: int, max_val: int):
        self.min_val = min_val
        self.max_val = max_val
    
    def validate(self, value: int) -> int:
        """Validate integer is within bounds"""
        if not isinstance(value, int):
            raise ValidationError("value", f"Expected int, got {type(value).__name__}")
        
        # Use native extension (fastest) or ctypes (fast) or pure Python (fallback)
        if HAS_NATIVE_EXT:
            if not _dhi_native.validate_int(value, self.min_val, self.max_val):
                if value < self.min_val:
                    raise ValidationError("value", f"Value {value} must be >= {self.min_val}")
                else:
                    raise ValidationError("value", f"Value {value} must be <= {self.max_val}")
        elif _zig.available:
            if not _zig.validate_int(value, self.min_val, self.max_val):
                if value < self.min_val:
                    raise ValidationError("value", f"Value {value} must be >= {self.min_val}")
                else:
                    raise ValidationError("value", f"Value {value} must be <= {self.max_val}")
        else:
            # Fallback to pure Python
            if value < self.min_val:
                raise ValidationError("value", f"Value {value} must be >= {self.min_val}")
            
            if value > self.max_val:
                raise ValidationError("value", f"Value {value} must be <= {self.max_val}")
        
        return value
    
    def __call__(self, value: int) -> int:
        """Allow using as a callable validator"""
        return self.validate(value)


class BoundedString:
    """String with length bounds validation"""
    
    def __init__(self, min_len: int, max_len: int):
        self.min_len = min_len
        self.max_len = max_len
    
    def validate(self, value: str) -> str:
        """Validate string length is within bounds"""
        if not isinstance(value, str):
            raise ValidationError("value", f"Expected str, got {type(value).__name__}")
        
        # Use native extension (fastest) or ctypes (fast) or pure Python (fallback)
        if HAS_NATIVE_EXT:
            if not _dhi_native.validate_string_length(value, self.min_len, self.max_len):
                if len(value) < self.min_len:
                    raise ValidationError("value", f"String length {len(value)} must be >= {self.min_len}")
                else:
                    raise ValidationError("value", f"String length {len(value)} must be <= {self.max_len}")
        elif _zig.available:
            if not _zig.validate_string_length(value, self.min_len, self.max_len):
                if len(value) < self.min_len:
                    raise ValidationError("value", f"String length {len(value)} must be >= {self.min_len}")
                else:
                    raise ValidationError("value", f"String length {len(value)} must be <= {self.max_len}")
        else:
            # Fallback to pure Python
            if len(value) < self.min_len:
                raise ValidationError("value", f"String length {len(value)} must be >= {self.min_len}")
            
            if len(value) > self.max_len:
                raise ValidationError("value", f"String length {len(value)} must be <= {self.max_len}")
        
        return value
    
    def __call__(self, value: str) -> str:
        """Allow using as a callable validator"""
        return self.validate(value)


class Email:
    """Email format validation"""
    
    @staticmethod
    def validate(value: str) -> str:
        """Validate email format (simple check)"""
        if not isinstance(value, str):
            raise ValidationError("value", f"Expected str, got {type(value).__name__}")
        
        # Use native extension (fastest) or ctypes (fast) or pure Python (fallback)
        if HAS_NATIVE_EXT:
            if not _dhi_native.validate_email(value):
                raise ValidationError("value", "Invalid email format (expected: local@domain)")
        elif _zig.available:
            if not _zig.validate_email(value):
                raise ValidationError("value", "Invalid email format (expected: local@domain)")
        else:
            # Fallback to pure Python
            if "@" not in value or "." not in value.split("@")[-1]:
                raise ValidationError("value", "Invalid email format (expected: local@domain)")
        
        return value
    
    @staticmethod
    def __call__(value: str) -> str:
        """Allow using as a callable validator"""
        return Email.validate(value)


# TODO: Load Zig shared library for native performance
# This is a pure Python implementation for now
# Future: Use ctypes to call into libsatya.so for 100x+ speedup

class _ZigValidator:
    """Native Zig validator"""
    
    def __init__(self):
        self._lib = None
        self._try_load_native()
    
    def _try_load_native(self):
        """Try to load native Zig library"""
        lib_path = Path(__file__).parent.parent.parent / "zig-out" / "lib"
        
        # Try different library names
        for name in ["libsatya.dylib", "libsatya.so", "satya.dll"]:
            full_path = lib_path / name
            if full_path.exists():
                try:
                    self._lib = ctypes.CDLL(str(full_path))
                    
                    # Define function signatures
                    self._lib.satya_validate_int.argtypes = [ctypes.c_int64, ctypes.c_int64, ctypes.c_int64]
                    self._lib.satya_validate_int.restype = ctypes.c_int32
                    
                    self._lib.satya_validate_string_length.argtypes = [ctypes.c_char_p, ctypes.c_size_t, ctypes.c_size_t]
                    self._lib.satya_validate_string_length.restype = ctypes.c_int32
                    
                    self._lib.satya_validate_email.argtypes = [ctypes.c_char_p]
                    self._lib.satya_validate_email.restype = ctypes.c_int32
                    
                    self._lib.satya_version.argtypes = []
                    self._lib.satya_version.restype = ctypes.c_char_p
                    
                    version = self._lib.satya_version().decode('utf-8')
                    print(f"✅ Loaded native Zig library v{version}: {name}")
                    return
                except Exception as e:
                    print(f"⚠️  Failed to load {name}: {e}")
        
        if not HAS_NATIVE_EXT:
            print("ℹ️  Using pure Python implementation (slower)")
    
    @property
    def available(self) -> bool:
        """Check if native library is available"""
        return self._lib is not None
    
    def validate_int(self, value: int, min_val: int, max_val: int) -> bool:
        """Validate integer using native Zig"""
        if not self.available:
            return min_val <= value <= max_val
        return bool(self._lib.satya_validate_int(value, min_val, max_val))
    
    def validate_string_length(self, value: str, min_len: int, max_len: int) -> bool:
        """Validate string length using native Zig"""
        if not self.available:
            return min_len <= len(value) <= max_len
        return bool(self._lib.satya_validate_string_length(value.encode('utf-8'), min_len, max_len))
    
    def validate_email(self, value: str) -> bool:
        """Validate email using native Zig"""
        if not self.available:
            return "@" in value and "." in value.split("@")[-1]
        return bool(self._lib.satya_validate_email(value.encode('utf-8')))


# Global instance
_zig = _ZigValidator()
