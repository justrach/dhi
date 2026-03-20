# dhi - Ultra-Fast Data Validation for Python

**The fastest data validation library for Python.** Powered by Zig for maximum performance.

## 🚀 Performance

**24 million validations/sec** - 4x faster than msgspec (C), 31x faster than msgspec-ext, 523x faster than Pydantic

```python
# Validate 10,000 users in 0.36ms
from dhi import _dhi_native

users = [{"name": "Alice", "email": "alice@example.com", "age": 25}, ...]

field_specs = {
    'name': ('string', 2, 100),
    'email': ('email',),
    'age': ('int_positive',),
}

results, valid_count = _dhi_native.validate_batch_direct(users, field_specs)
# 28M users/sec! 🔥
```

## ✨ Features

- **⚡ Fastest**: 4x faster than msgspec (C), 31x faster than msgspec-ext, 523x faster than Pydantic
- **🎯 24+ Validators**: Email, URL, UUID, IPv4, dates, numbers, strings
- **🔋 Zero Python Overhead**: C extension extracts directly from dicts
- **🌍 General Purpose**: Works with any dict structure
- **💪 Production Ready**: Thoroughly tested and benchmarked

## 📦 Installation

```bash
pip install dhi
```

## 🎯 Quick Start

```python
from dhi import _dhi_native

users = [
    {"name": "Alice", "email": "alice@example.com", "age": 25},
    {"name": "Bob", "email": "bob@example.com", "age": 30},
]

field_specs = {
    'name': ('string', 2, 100),
    'email': ('email',),
    'age': ('int_positive',),
}

results, valid_count = _dhi_native.validate_batch_direct(users, field_specs)
print(f"Valid: {valid_count}/{len(users)}")
```

## �� Available Validators

### String: `email`, `url`, `uuid`, `ipv4`, `base64`, `iso_date`, `iso_datetime`, `string`
### Number: `int`, `int_gt`, `int_gte`, `int_lt`, `int_lte`, `int_positive`, `int_non_negative`, `int_multiple_of`

## 🏆 Benchmarks

10,000 users validated with email, URL, and positive-int checks:

```
dhi (Zig+C):      24M users/sec  🥇
msgspec (C):       5.8M users/sec  (4.2x slower)
satya (Rust):      2.1M users/sec  (11.5x slower)
msgspec-ext:       777K users/sec  (31x slower)
Pydantic V2:        46K users/sec  (523x slower)
```

## 📝 License

MIT License - see LICENSE file

## Links

- GitHub: https://github.com/justrach/dhi
- PyPI: https://pypi.org/project/dhi/
