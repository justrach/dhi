/*
 * Native CPython extension for dhi
 * Links against libsatya.dylib (Zig backend)
 */

#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <math.h>

// External Zig functions from libsatya - COMPREHENSIVE VALIDATORS
// Basic validators
extern int satya_validate_int(long value, long min, long max);
extern int satya_validate_string_length(const char* str, size_t min_len, size_t max_len);
extern int satya_validate_email(const char* str);

// String validators (Zod-style)
extern int satya_validate_url(const char* str);
extern int satya_validate_uuid(const char* str);
extern int satya_validate_ipv4(const char* str);
extern int satya_validate_base64(const char* str);
extern int satya_validate_iso_date(const char* str);
extern int satya_validate_iso_datetime(const char* str);
extern int satya_validate_contains(const char* str, const char* substring);
extern int satya_validate_starts_with(const char* str, const char* prefix);
extern int satya_validate_ends_with(const char* str, const char* suffix);

// Number validators (Pydantic-style)
extern int satya_validate_int_gt(long value, long min);
extern int satya_validate_int_gte(long value, long min);
extern int satya_validate_int_lt(long value, long max);
extern int satya_validate_int_lte(long value, long max);
extern int satya_validate_int_positive(long value);
extern int satya_validate_int_non_negative(long value);
extern int satya_validate_int_negative(long value);
extern int satya_validate_int_non_positive(long value);
extern int satya_validate_int_multiple_of(long value, long divisor);

// Float validators
extern int satya_validate_float_gt(double value, double min);
extern int satya_validate_float_gte(double value, double min);
extern int satya_validate_float_lt(double value, double max);
extern int satya_validate_float_lte(double value, double max);
extern int satya_validate_float_finite(double value);

// IPv6 validator
extern int satya_validate_ipv6(const char* str);

// Python wrapper: validate_int(value, min, max) -> bool
static PyObject* py_validate_int(PyObject* self, PyObject* args) {
    long value, min, max;
    
    if (!PyArg_ParseTuple(args, "lll", &value, &min, &max)) {
        return NULL;
    }
    
    int result = satya_validate_int(value, min, max);
    return PyBool_FromLong(result);
}

// Python wrapper: validate_string_length(str, min_len, max_len) -> bool
static PyObject* py_validate_string_length(PyObject* self, PyObject* args) {
    const char* str;
    Py_ssize_t min_len, max_len;
    
    if (!PyArg_ParseTuple(args, "snn", &str, &min_len, &max_len)) {
        return NULL;
    }
    
    int result = satya_validate_string_length(str, (size_t)min_len, (size_t)max_len);
    return PyBool_FromLong(result);
}

// Python wrapper: validate_email(str) -> bool
static PyObject* py_validate_email(PyObject* self, PyObject* args) {
    const char* str;
    
    if (!PyArg_ParseTuple(args, "s", &str)) {
        return NULL;
    }
    
    int result = satya_validate_email(str);
    return PyBool_FromLong(result);
}

// Validator type enum for fast dispatch
enum ValidatorType {
    VAL_INT = 0,
    VAL_INT_GT,
    VAL_INT_GTE,
    VAL_INT_LT,
    VAL_INT_LTE,
    VAL_INT_POSITIVE,
    VAL_INT_NON_NEGATIVE,
    VAL_INT_MULTIPLE_OF,
    VAL_STRING,
    VAL_EMAIL,
    VAL_URL,
    VAL_UUID,
    VAL_IPV4,
    VAL_BASE64,
    VAL_ISO_DATE,
    VAL_ISO_DATETIME,
    VAL_UNKNOWN
};

// Convert string to enum (do this ONCE, not per item!)
static enum ValidatorType parse_validator_type(const char* type_str) {
    // Use first char for fast dispatch
    switch (type_str[0]) {
        case 'i':
            if (strcmp(type_str, "int") == 0) return VAL_INT;
            if (strcmp(type_str, "int_gt") == 0) return VAL_INT_GT;
            if (strcmp(type_str, "int_gte") == 0) return VAL_INT_GTE;
            if (strcmp(type_str, "int_lt") == 0) return VAL_INT_LT;
            if (strcmp(type_str, "int_lte") == 0) return VAL_INT_LTE;
            if (strcmp(type_str, "int_positive") == 0) return VAL_INT_POSITIVE;
            if (strcmp(type_str, "int_non_negative") == 0) return VAL_INT_NON_NEGATIVE;
            if (strcmp(type_str, "int_multiple_of") == 0) return VAL_INT_MULTIPLE_OF;
            if (strcmp(type_str, "ipv4") == 0) return VAL_IPV4;
            if (strcmp(type_str, "iso_date") == 0) return VAL_ISO_DATE;
            if (strcmp(type_str, "iso_datetime") == 0) return VAL_ISO_DATETIME;
            break;
        case 's':
            if (strcmp(type_str, "string") == 0) return VAL_STRING;
            break;
        case 'e':
            if (strcmp(type_str, "email") == 0) return VAL_EMAIL;
            break;
        case 'u':
            if (strcmp(type_str, "url") == 0) return VAL_URL;
            if (strcmp(type_str, "uuid") == 0) return VAL_UUID;
            break;
        case 'b':
            if (strcmp(type_str, "base64") == 0) return VAL_BASE64;
            break;
    }
    return VAL_UNKNOWN;
}

// Field spec with pre-parsed validator type AND cached PyObject
struct FieldSpec {
    PyObject* field_name_obj;  // Cached PyObject* for fast dict lookup
    const char* field_name;
    enum ValidatorType validator_type;
    long param1;
    long param2;
};

// OPTIMIZED: validate_batch_direct with enum dispatch
static PyObject* py_validate_batch_direct(PyObject* self, PyObject* args) {
    PyObject* items_list;
    PyObject* field_specs_dict;
    
    if (!PyArg_ParseTuple(args, "O!O!", 
                          &PyList_Type, &items_list,
                          &PyDict_Type, &field_specs_dict)) {
        return NULL;
    }
    
    Py_ssize_t count = PyList_Size(items_list);
    if (count == 0) {
        return Py_BuildValue("([]i)", 0);
    }
    
    // Pre-process field specs (convert strings to enums ONCE!)
    Py_ssize_t num_fields = PyDict_Size(field_specs_dict);
    struct FieldSpec* field_specs = malloc(num_fields * sizeof(struct FieldSpec));
    if (!field_specs) {
        return PyErr_NoMemory();
    }
    
    PyObject *field_name, *spec;
    Py_ssize_t pos = 0;
    Py_ssize_t field_idx = 0;
    
    while (PyDict_Next(field_specs_dict, &pos, &field_name, &spec)) {
        field_specs[field_idx].field_name_obj = field_name;  // Cache PyObject* (borrowed ref)
        field_specs[field_idx].field_name = PyUnicode_AsUTF8(field_name);
        
        if (PyTuple_Check(spec) && PyTuple_Size(spec) >= 1) {
            const char* type_str = PyUnicode_AsUTF8(PyTuple_GET_ITEM(spec, 0));
            field_specs[field_idx].validator_type = parse_validator_type(type_str);
            
            // Extract params (do this once, not per item!)
            field_specs[field_idx].param1 = 0;
            field_specs[field_idx].param2 = 0;
            if (PyTuple_Size(spec) >= 2) {
                field_specs[field_idx].param1 = PyLong_AsLong(PyTuple_GET_ITEM(spec, 1));
            }
            if (PyTuple_Size(spec) >= 3) {
                field_specs[field_idx].param2 = PyLong_AsLong(PyTuple_GET_ITEM(spec, 2));
            }
        } else {
            field_specs[field_idx].validator_type = VAL_UNKNOWN;
        }
        field_idx++;
    }
    
    // Allocate results array
    unsigned char* results = malloc(count * sizeof(unsigned char));
    if (!results) {
        free(field_specs);
        return PyErr_NoMemory();
    }
    
    // Initialize all as valid
    for (Py_ssize_t i = 0; i < count; i++) {
        results[i] = 1;
    }
    
    size_t valid_count = count;
    
    // Iterate through each item and validate all fields (OPTIMIZED with enum dispatch)
    for (Py_ssize_t i = 0; i < count; i++) {
        PyObject* item = PyList_GET_ITEM(items_list, i);  // Borrowed ref
        
        // Prefetch next item for better cache performance
        if (i + 1 < count) {
            __builtin_prefetch(PyList_GET_ITEM(items_list, i + 1), 0, 3);
        }
        
        // Fast dict check with branch prediction hint (usually true)
        if (__builtin_expect(!PyDict_Check(item), 0)) {
            free(field_specs);
            free(results);
            PyErr_SetString(PyExc_TypeError, "Expected list of dicts");
            return NULL;
        }
        
        // Iterate through pre-parsed field specs (ULTRA-FAST: use cached PyObject*)
        for (Py_ssize_t f = 0; f < num_fields; f++) {
            // Use PyDict_GetItem with cached PyObject* - FASTEST (borrowed ref, no refcount overhead)
            PyObject* field_value = PyDict_GetItem(item, field_specs[f].field_name_obj);
            
            if (!field_value) {
                // Missing field
                if (results[i] == 1) {
                    results[i] = 0;
                    valid_count--;
                }
                break;  // Missing field, skip remaining validations
            }
            
            // Fast dispatch using switch/case (NO string comparisons!)
            int is_valid = 1;
            
            switch (field_specs[f].validator_type) {
                case VAL_INT: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int(value, field_specs[f].param1, field_specs[f].param2);
                    break;
                }
                case VAL_INT_GT: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_gt(value, field_specs[f].param1);
                    break;
                }
                case VAL_INT_GTE: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_gte(value, field_specs[f].param1);
                    break;
                }
                case VAL_INT_LT: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_lt(value, field_specs[f].param1);
                    break;
                }
                case VAL_INT_LTE: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_lte(value, field_specs[f].param1);
                    break;
                }
                case VAL_INT_POSITIVE: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_positive(value);
                    break;
                }
                case VAL_INT_NON_NEGATIVE: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_non_negative(value);
                    break;
                }
                case VAL_INT_MULTIPLE_OF: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_multiple_of(value, field_specs[f].param1);
                    break;
                }
                case VAL_STRING: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_string_length(value, (size_t)field_specs[f].param1, (size_t)field_specs[f].param2);
                    break;
                }
                case VAL_EMAIL: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_email(value);
                    break;
                }
                case VAL_URL: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_url(value);
                    break;
                }
                case VAL_UUID: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_uuid(value);
                    break;
                }
                case VAL_IPV4: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_ipv4(value);
                    break;
                }
                case VAL_BASE64: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_base64(value);
                    break;
                }
                case VAL_ISO_DATE: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_iso_date(value);
                    break;
                }
                case VAL_ISO_DATETIME: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_iso_datetime(value);
                    break;
                }
                case VAL_UNKNOWN:
                default:
                    is_valid = 1;  // Skip unknown validators
                    break;
            }
            
            // Update result if invalid (FAST: branch prediction - valid is common case)
            if (__builtin_expect(!is_valid, 0)) {  // Hint: validation usually succeeds
                if (results[i] == 1) {
                    results[i] = 0;
                    valid_count--;
                }
                break;  // Already invalid, skip remaining validations
            }
        }
    }
    
    // Convert results to Python list (FAST: use singleton bools, no allocations!)
    PyObject* result_list = PyList_New(count);
    for (Py_ssize_t i = 0; i < count; i++) {
        PyObject* bool_obj = results[i] ? Py_True : Py_False;
        Py_INCREF(bool_obj);  // Must incref singleton
        PyList_SET_ITEM(result_list, i, bool_obj);
    }
    
    // Cleanup
    free(field_specs);
    free(results);
    
    // Return (results, valid_count)
    return Py_BuildValue("(Ni)", result_list, (Py_ssize_t)valid_count);
}

// Helpers: safely extract numeric values from PyObject (handles int/float mix)
static long as_long_coerce(PyObject* obj) {
    if (PyLong_Check(obj)) return PyLong_AsLong(obj);
    if (PyFloat_Check(obj)) return (long)PyFloat_AsDouble(obj);
    return PyLong_AsLong(obj);
}

static double as_double_coerce(PyObject* obj) {
    if (PyFloat_Check(obj)) return PyFloat_AsDouble(obj);
    if (PyLong_Check(obj)) return (double)PyLong_AsLong(obj);
    return PyFloat_AsDouble(obj);
}

// =============================================================================
// validate_field: Single C call per field — type check + constraints + format
// Constraints tuple format:
//   (type_code, strict, gt, ge, lt, le, multiple_of, min_len, max_len,
//    allow_inf_nan, format_code, strip_ws, to_lower, to_upper)
//
// type_code: 0=any, 1=int, 2=float, 3=str, 4=bool, 5=bytes
// format_code: 0=none, 1=email, 2=url, 3=uuid, 4=ipv4, 5=ipv6,
//              6=base64, 7=iso_date, 8=iso_datetime
// =============================================================================

// Core validation logic - no arg parsing overhead
static PyObject* validate_field_core(PyObject *value, const char *field_name, PyObject *constraints) {
    // Unpack constraints
    int type_code    = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 0));
    int strict       = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 1));
    PyObject *gt_obj = PyTuple_GET_ITEM(constraints, 2);
    PyObject *ge_obj = PyTuple_GET_ITEM(constraints, 3);
    PyObject *lt_obj = PyTuple_GET_ITEM(constraints, 4);
    PyObject *le_obj = PyTuple_GET_ITEM(constraints, 5);
    PyObject *mul_obj = PyTuple_GET_ITEM(constraints, 6);
    PyObject *minl_obj = PyTuple_GET_ITEM(constraints, 7);
    PyObject *maxl_obj = PyTuple_GET_ITEM(constraints, 8);
    int allow_inf_nan = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 9));
    int format_code   = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 10));
    int strip_ws     = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 11));
    int to_lower     = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 12));
    int to_upper     = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 13));

    PyObject* result = value;
    Py_INCREF(result);

    // --- TYPE CHECKING ---
    if (type_code == 1) { // int
        if (strict) {
            if (!PyLong_CheckExact(result) || PyBool_Check(result)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Expected exactly int, got %s",
                    field_name, Py_TYPE(value)->tp_name);
            }
        } else {
            if (PyBool_Check(result)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Expected int, got bool", field_name);
            }
            if (!PyLong_Check(result)) {
                if (PyFloat_Check(result)) {
                    // Coerce float to int
                    PyObject* new_val = PyNumber_Long(result);
                    if (!new_val) {
                        Py_DECREF(result);
                        return PyErr_Format(PyExc_ValueError,
                            "%s: Cannot convert float to int", field_name);
                    }
                    Py_DECREF(result);
                    result = new_val;
                } else {
                    Py_DECREF(result);
                    return PyErr_Format(PyExc_ValueError,
                        "%s: Expected int, got %s",
                        field_name, Py_TYPE(value)->tp_name);
                }
            }
        }
    } else if (type_code == 2) { // float
        if (strict) {
            if (!PyFloat_CheckExact(result)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Expected exactly float, got %s",
                    field_name, Py_TYPE(value)->tp_name);
            }
        } else {
            if (PyBool_Check(result)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Expected float, got bool", field_name);
            }
            if (!PyFloat_Check(result)) {
                if (PyLong_Check(result)) {
                    PyObject* new_val = PyNumber_Float(result);
                    if (!new_val) {
                        Py_DECREF(result);
                        return PyErr_Format(PyExc_ValueError,
                            "%s: Cannot convert int to float", field_name);
                    }
                    Py_DECREF(result);
                    result = new_val;
                } else {
                    Py_DECREF(result);
                    return PyErr_Format(PyExc_ValueError,
                        "%s: Expected float, got %s",
                        field_name, Py_TYPE(value)->tp_name);
                }
            }
        }
    } else if (type_code == 3) { // str
        if (!PyUnicode_Check(result)) {
            Py_DECREF(result);
            return PyErr_Format(PyExc_ValueError,
                "%s: Expected str, got %s",
                field_name, Py_TYPE(value)->tp_name);
        }
    } else if (type_code == 4) { // bool
        if (!PyBool_Check(result)) {
            Py_DECREF(result);
            return PyErr_Format(PyExc_ValueError,
                "%s: Expected bool, got %s",
                field_name, Py_TYPE(value)->tp_name);
        }
    } else if (type_code == 5) { // bytes
        if (!PyBytes_Check(result)) {
            Py_DECREF(result);
            return PyErr_Format(PyExc_ValueError,
                "%s: Expected bytes, got %s",
                field_name, Py_TYPE(value)->tp_name);
        }
    }

    // --- STRING TRANSFORMS (before validation) ---
    if (PyUnicode_Check(result)) {
        if (strip_ws) {
            PyObject* stripped = PyObject_CallMethod(result, "strip", NULL);
            if (!stripped) { Py_DECREF(result); return NULL; }
            Py_DECREF(result);
            result = stripped;
        }
        if (to_lower) {
            PyObject* lowered = PyObject_CallMethod(result, "lower", NULL);
            if (!lowered) { Py_DECREF(result); return NULL; }
            Py_DECREF(result);
            result = lowered;
        }
        if (to_upper) {
            PyObject* uppered = PyObject_CallMethod(result, "upper", NULL);
            if (!uppered) { Py_DECREF(result); return NULL; }
            Py_DECREF(result);
            result = uppered;
        }
    }

    // --- NUMERIC CONSTRAINTS (use Zig validators) ---
    if (PyLong_Check(result) && !PyBool_Check(result)) {
        long val = PyLong_AsLong(result);
        if (gt_obj != Py_None) {
            long gt_val = as_long_coerce(gt_obj);
            if (!satya_validate_int_gt(val, gt_val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be > %ld, got %ld", field_name, gt_val, val);
            }
        }
        if (ge_obj != Py_None) {
            long ge_val = as_long_coerce(ge_obj);
            if (!satya_validate_int_gte(val, ge_val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be >= %ld, got %ld", field_name, ge_val, val);
            }
        }
        if (lt_obj != Py_None) {
            long lt_val = as_long_coerce(lt_obj);
            if (!satya_validate_int_lt(val, lt_val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be < %ld, got %ld", field_name, lt_val, val);
            }
        }
        if (le_obj != Py_None) {
            long le_val = as_long_coerce(le_obj);
            if (!satya_validate_int_lte(val, le_val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be <= %ld, got %ld", field_name, le_val, val);
            }
        }
        if (mul_obj != Py_None) {
            long mul_val = as_long_coerce(mul_obj);
            if (!satya_validate_int_multiple_of(val, mul_val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be a multiple of %ld, got %ld", field_name, mul_val, val);
            }
        }
    } else if (PyFloat_Check(result)) {
        double val = PyFloat_AsDouble(result);
        if (!allow_inf_nan) {
            if (!satya_validate_float_finite(val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be finite", field_name);
            }
        }
        if (gt_obj != Py_None) {
            double gt_val = as_double_coerce(gt_obj);
            if (!satya_validate_float_gt(val, gt_val)) {
                char buf[128];
                snprintf(buf, sizeof(buf), "%s: Value must be > %g, got %g", field_name, gt_val, val);
                Py_DECREF(result);
                PyErr_SetString(PyExc_ValueError, buf);
                return NULL;
            }
        }
        if (ge_obj != Py_None) {
            double ge_val = as_double_coerce(ge_obj);
            if (!satya_validate_float_gte(val, ge_val)) {
                char buf[128];
                snprintf(buf, sizeof(buf), "%s: Value must be >= %g, got %g", field_name, ge_val, val);
                Py_DECREF(result);
                PyErr_SetString(PyExc_ValueError, buf);
                return NULL;
            }
        }
        if (lt_obj != Py_None) {
            double lt_val = as_double_coerce(lt_obj);
            if (!satya_validate_float_lt(val, lt_val)) {
                char buf[128];
                snprintf(buf, sizeof(buf), "%s: Value must be < %g, got %g", field_name, lt_val, val);
                Py_DECREF(result);
                PyErr_SetString(PyExc_ValueError, buf);
                return NULL;
            }
        }
        if (le_obj != Py_None) {
            double le_val = as_double_coerce(le_obj);
            if (!satya_validate_float_lte(val, le_val)) {
                char buf[128];
                snprintf(buf, sizeof(buf), "%s: Value must be <= %g, got %g", field_name, le_val, val);
                Py_DECREF(result);
                PyErr_SetString(PyExc_ValueError, buf);
                return NULL;
            }
        }
        if (mul_obj != Py_None) {
            double mul_val = as_double_coerce(mul_obj);
            double remainder = fmod(val, mul_val);
            if (remainder != 0.0 && fabs(remainder) > 1e-9) {
                char buf[128];
                snprintf(buf, sizeof(buf), "%s: Value must be a multiple of %g, got %g", field_name, mul_val, val);
                Py_DECREF(result);
                PyErr_SetString(PyExc_ValueError, buf);
                return NULL;
            }
        }
    }

    // --- LENGTH CONSTRAINTS ---
    if (minl_obj != Py_None || maxl_obj != Py_None) {
        Py_ssize_t length = PyObject_Length(result);
        if (length == -1 && PyErr_Occurred()) {
            Py_DECREF(result);
            return NULL;
        }
        if (minl_obj != Py_None) {
            Py_ssize_t min_len = PyLong_AsSsize_t(minl_obj);
            if (length < min_len) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Length must be >= %zd, got %zd", field_name, min_len, length);
            }
        }
        if (maxl_obj != Py_None) {
            Py_ssize_t max_len = PyLong_AsSsize_t(maxl_obj);
            if (length > max_len) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Length must be <= %zd, got %zd", field_name, max_len, length);
            }
        }
    }

    // --- FORMAT VALIDATION (Zig-powered) ---
    if (format_code > 0 && PyUnicode_Check(result)) {
        const char* str_val = PyUnicode_AsUTF8(result);
        if (!str_val) { Py_DECREF(result); return NULL; }
        int valid = 1;
        const char* fmt_name = "unknown format";

        switch (format_code) {
            case 1: valid = satya_validate_email(str_val); fmt_name = "email"; break;
            case 2: valid = satya_validate_url(str_val); fmt_name = "URL"; break;
            case 3: valid = satya_validate_uuid(str_val); fmt_name = "UUID"; break;
            case 4: valid = satya_validate_ipv4(str_val); fmt_name = "IPv4"; break;
            case 5: valid = satya_validate_ipv6(str_val); fmt_name = "IPv6"; break;
            case 6: valid = satya_validate_base64(str_val); fmt_name = "base64"; break;
            case 7: valid = satya_validate_iso_date(str_val); fmt_name = "ISO date"; break;
            case 8: valid = satya_validate_iso_datetime(str_val); fmt_name = "ISO datetime"; break;
        }

        if (!valid) {
            Py_DECREF(result);
            return PyErr_Format(PyExc_ValueError,
                "%s: Invalid %s format", field_name, fmt_name);
        }
    }

    return result;  // Validated (possibly transformed) value
}

// Python wrapper for validate_field - thin wrapper around core
static PyObject* py_validate_field(PyObject* self, PyObject* args) {
    PyObject *value, *field_name_obj, *constraints;
    if (!PyArg_ParseTuple(args, "OOO!", &value, &field_name_obj, &PyTuple_Type, &constraints)) {
        return NULL;
    }
    const char* field_name = PyUnicode_AsUTF8(field_name_obj);
    if (!field_name) return NULL;
    return validate_field_core(value, field_name, constraints);
}

// =============================================================================
// init_model: Batch init — ONE Python→C call for the entire __init__
// Validates all fields, sets attributes directly on self.__dict__
//
// init_model(self, kwargs_dict, field_specs)
// field_specs: tuple of (field_name_str, alias_or_None, required_bool,
//              default_obj, constraints_tuple)
// Returns: None on success, or list of (field_name, error_msg) tuples on error
// =============================================================================
static PyObject* py_init_model(PyObject* self_unused, PyObject* args) {
    PyObject *model_self, *kwargs, *field_specs;

    if (!PyArg_ParseTuple(args, "OO!O!", &model_self, &PyDict_Type, &kwargs,
                          &PyTuple_Type, &field_specs)) {
        return NULL;
    }

    // Get self.__dict__ for fast direct attribute setting
    PyObject *obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) return NULL;

    Py_ssize_t n_fields = PyTuple_GET_SIZE(field_specs);
    PyObject *errors = NULL;  // Lazy-allocated list of (name, msg) tuples

    for (Py_ssize_t i = 0; i < n_fields; i++) {
        PyObject *spec = PyTuple_GET_ITEM(field_specs, i);
        PyObject *name_obj   = PyTuple_GET_ITEM(spec, 0);
        PyObject *alias_obj  = PyTuple_GET_ITEM(spec, 1);
        int required         = PyObject_IsTrue(PyTuple_GET_ITEM(spec, 2));
        PyObject *default_val = PyTuple_GET_ITEM(spec, 3);
        PyObject *constraints = PyTuple_GET_ITEM(spec, 4);

        // --- Extract value from kwargs ---
        PyObject *value = NULL;
        if (alias_obj != Py_None) {
            value = PyDict_GetItem(kwargs, alias_obj);  // borrowed ref
        }
        if (value == NULL) {
            value = PyDict_GetItem(kwargs, name_obj);   // borrowed ref
        }

        if (value == NULL) {
            if (!required) {
                // Set default directly in __dict__
                PyDict_SetItem(obj_dict, name_obj, default_val);
                continue;
            } else {
                // Missing required field — collect error
                if (!errors) {
                    errors = PyList_New(0);
                    if (!errors) { Py_DECREF(obj_dict); return NULL; }
                }
                PyObject *err = Py_BuildValue("(Os)", name_obj, "Field required");
                PyList_Append(errors, err);
                Py_DECREF(err);
                continue;
            }
        }

        // --- Validate field ---
        const char *field_name = PyUnicode_AsUTF8(name_obj);
        if (!field_name) { Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }

        PyObject *validated = validate_field_core(value, field_name, constraints);
        if (validated == NULL) {
            // Validation failed — capture error message
            if (!errors) {
                errors = PyList_New(0);
                if (!errors) { Py_DECREF(obj_dict); PyErr_Clear(); return NULL; }
            }
            PyObject *exc_type, *exc_value, *exc_tb;
            PyErr_Fetch(&exc_type, &exc_value, &exc_tb);
            PyObject *msg = exc_value ? PyObject_Str(exc_value) : PyUnicode_FromString("Validation failed");
            PyObject *err = Py_BuildValue("(OO)", name_obj, msg);
            PyList_Append(errors, err);
            Py_DECREF(err);
            Py_DECREF(msg);
            Py_XDECREF(exc_type);
            Py_XDECREF(exc_value);
            Py_XDECREF(exc_tb);
            continue;
        }

        // Set validated value directly in __dict__ (fastest path)
        PyDict_SetItem(obj_dict, name_obj, validated);
        Py_DECREF(validated);
    }

    Py_DECREF(obj_dict);

    if (errors && PyList_GET_SIZE(errors) > 0) {
        // Return errors list for Python to wrap in ValidationErrors
        return errors;
    }
    Py_XDECREF(errors);
    Py_RETURN_NONE;
}

// Method definitions
static PyMethodDef DhiNativeMethods[] = {
    {"validate_int", py_validate_int, METH_VARARGS, 
     "Validate integer bounds (value, min, max) -> bool"},
    {"validate_string_length", py_validate_string_length, METH_VARARGS,
     "Validate string length (str, min_len, max_len) -> bool"},
    {"validate_email", py_validate_email, METH_VARARGS,
     "Validate email format (str) -> bool"},
    {"validate_batch_direct", py_validate_batch_direct, METH_VARARGS,
     "GENERAL batch validation: (items, field_specs) -> (list[bool], int)"},
    {"validate_field", py_validate_field, METH_VARARGS,
     "Validate a single field: (value, field_name, constraints) -> validated_value"},
    {"init_model", py_init_model, METH_VARARGS,
     "Batch init: (self, kwargs, field_specs) -> None or errors list"},
    {NULL, NULL, 0, NULL}
};

// Module definition
static struct PyModuleDef dhi_native_module = {
    PyModuleDef_HEAD_INIT,
    "_dhi_native",
    "Native Zig validators for dhi (CPython extension)",
    -1,
    DhiNativeMethods
};

// Module initialization
PyMODINIT_FUNC PyInit__dhi_native(void) {
    return PyModule_Create(&dhi_native_module);
}
