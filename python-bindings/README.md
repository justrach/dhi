# dhi - Ultra-Fast Data Validation for Python

**The fastest data validation library for Python.** Powered by Zig for maximum performance.

## 🚀 Performance

**33.18M rows/sec** on `name+email+age` batches, **16.13M rows/sec** on six-field batches, and **461.19M ints/sec** on the direct integer-list batch path.

```python
# Validate 10,000 users in about 0.30ms
from dhi import _dhi_native

users = [{"name": "Alice", "email": "alice@example.com", "age": 25}, ...]

field_specs = {
    'name': ('string', 2, 100),
    'email': ('email',),
    'age': ('int_positive',),
}

results, valid_count = _dhi_native.validate_batch_direct(users, field_specs)
# 33M rows/sec on name+email+age batches
```

## ✨ Features

- **⚡ Fastest**: 33.18M rows/sec on `name+email+age`, 25.35M rows/sec with URL checks, and 461.19M ints/sec for direct integer-list validation
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

Release 1.3.1 native batch results on 10,000-row batches:

```
name+email+age:             33.18M rows/sec  (~28% faster than the earlier 26M baseline)
name+email+age+url:         25.35M rows/sec  (~27% faster than the earlier 20M baseline)
name+email+age+url+uuid:    20.51M rows/sec  (~28% faster than the earlier 16M baseline)
all 6 (+ ipv4):             16.13M rows/sec  (~47% faster than the earlier 11M baseline)
uuid only:                 112.78M rows/sec
ipv4 only:                  68.98M rows/sec
direct int range list:     461.19M ints/sec
```

## 📝 License

MIT License - see LICENSE file

## Links

- GitHub: https://github.com/justrach/dhi
- PyPI: https://pypi.org/project/dhi/
