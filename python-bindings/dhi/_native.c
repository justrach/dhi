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
// PRE-COMPILED FIELD SPECS — eliminates per-call constraint tuple unpacking
// =============================================================================

typedef struct {
    PyObject *name_obj;     // borrowed ref (kept alive by class)
    Py_hash_t name_hash;    // Pre-computed hash for fast dict operations
    PyObject *alias_obj;    // borrowed ref or NULL (Py_None)
    int required;
    PyObject *default_val;  // borrowed ref
    // Pre-parsed constraints (no per-call PyLong_AsLong/PyTuple_GET_ITEM):
    int type_code, strict;
    int has_gt, has_ge, has_lt, has_le, has_mul;
    long gt_long, ge_long, lt_long, le_long, mul_long;
    double gt_dbl, ge_dbl, lt_dbl, le_dbl, mul_dbl;
    int has_minl, has_maxl;
    Py_ssize_t min_len, max_len;
    int allow_inf_nan, format_code;
    int strip_ws, to_lower, to_upper;
    // Nested model support (type_code=6 for nested models)
    PyObject *nested_model_type;  // The nested BaseModel class (borrowed ref, or NULL)
} CompiledFieldSpec;

// Global empty tuple for efficient PyObject_Call - reused across all calls
static PyObject *g_empty_tuple = NULL;

typedef struct {
    Py_ssize_t n_fields;
    CompiledFieldSpec specs[];  // flexible array member
} CompiledModelSpecs;

static void compiled_specs_destructor(PyObject *capsule) {
    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (ms) free(ms);
}

// compile_model_specs(field_specs_tuple) -> PyCapsule
// Pre-parses all constraint values into C structs at class creation time
// Each field spec is: (name, alias, required, default, constraints, [nested_model_type])
// nested_model_type is optional - if present and not None, type_code is set to 6
static PyObject* py_compile_model_specs(PyObject* self, PyObject* args) {
    PyObject *field_specs;
    if (!PyArg_ParseTuple(args, "O!", &PyTuple_Type, &field_specs)) return NULL;

    Py_ssize_t n = PyTuple_GET_SIZE(field_specs);
    CompiledModelSpecs *ms = (CompiledModelSpecs*)malloc(
        sizeof(CompiledModelSpecs) + n * sizeof(CompiledFieldSpec));
    if (!ms) return PyErr_NoMemory();
    ms->n_fields = n;

    for (Py_ssize_t i = 0; i < n; i++) {
        PyObject *spec = PyTuple_GET_ITEM(field_specs, i);
        CompiledFieldSpec *fs = &ms->specs[i];
        Py_ssize_t spec_len = PyTuple_GET_SIZE(spec);

        fs->name_obj    = PyTuple_GET_ITEM(spec, 0);
        fs->name_hash   = PyObject_Hash(fs->name_obj);  // Pre-compute hash for fast dict ops
        fs->alias_obj   = PyTuple_GET_ITEM(spec, 1);
        fs->required    = PyObject_IsTrue(PyTuple_GET_ITEM(spec, 2));
        fs->default_val = PyTuple_GET_ITEM(spec, 3);
        PyObject *constraints = PyTuple_GET_ITEM(spec, 4);

        // Check for nested model type (6th element)
        fs->nested_model_type = NULL;
        if (spec_len >= 6) {
            PyObject *nested = PyTuple_GET_ITEM(spec, 5);
            if (nested != Py_None && PyType_Check(nested)) {
                fs->nested_model_type = nested;  // borrowed ref, kept alive by class
            }
        }

        // Pre-parse all constraint values ONCE (not per-call)
        fs->type_code = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 0));
        // Override type_code if this is a nested model field
        if (fs->nested_model_type != NULL) {
            fs->type_code = 6;  // Special type code for nested models
        }
        fs->strict    = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 1));

        PyObject *gt = PyTuple_GET_ITEM(constraints, 2);
        PyObject *ge = PyTuple_GET_ITEM(constraints, 3);
        PyObject *lt = PyTuple_GET_ITEM(constraints, 4);
        PyObject *le = PyTuple_GET_ITEM(constraints, 5);
        PyObject *mul = PyTuple_GET_ITEM(constraints, 6);
        PyObject *minl = PyTuple_GET_ITEM(constraints, 7);
        PyObject *maxl = PyTuple_GET_ITEM(constraints, 8);

        fs->has_gt = (gt != Py_None); fs->has_ge = (ge != Py_None);
        fs->has_lt = (lt != Py_None); fs->has_le = (le != Py_None);
        fs->has_mul = (mul != Py_None);
        fs->has_minl = (minl != Py_None); fs->has_maxl = (maxl != Py_None);

        fs->gt_long = fs->has_gt ? as_long_coerce(gt) : 0;
        fs->ge_long = fs->has_ge ? as_long_coerce(ge) : 0;
        fs->lt_long = fs->has_lt ? as_long_coerce(lt) : 0;
        fs->le_long = fs->has_le ? as_long_coerce(le) : 0;
        fs->mul_long = fs->has_mul ? as_long_coerce(mul) : 0;
        fs->gt_dbl = fs->has_gt ? as_double_coerce(gt) : 0.0;
        fs->ge_dbl = fs->has_ge ? as_double_coerce(ge) : 0.0;
        fs->lt_dbl = fs->has_lt ? as_double_coerce(lt) : 0.0;
        fs->le_dbl = fs->has_le ? as_double_coerce(le) : 0.0;
        fs->mul_dbl = fs->has_mul ? as_double_coerce(mul) : 0.0;
        fs->min_len = fs->has_minl ? PyLong_AsSsize_t(minl) : 0;
        fs->max_len = fs->has_maxl ? PyLong_AsSsize_t(maxl) : 0;

        fs->allow_inf_nan = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 9));
        fs->format_code   = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 10));
        fs->strip_ws      = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 11));
        fs->to_lower      = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 12));
        fs->to_upper      = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 13));
    }

    return PyCapsule_New(ms, "dhi.compiled_specs", compiled_specs_destructor);
}

// init_model_compiled: Ultra-fast path using pre-compiled C structs
// No per-call PyTuple_GET_ITEM/PyLong_AsLong — reads C struct members directly
static PyObject* py_init_model_compiled(PyObject* self_unused, PyObject* args) {
    PyObject *model_self, *kwargs, *capsule;

    if (!PyArg_ParseTuple(args, "OO!O", &model_self, &PyDict_Type, &kwargs, &capsule)) {
        return NULL;
    }

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) return NULL;

    PyObject *obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) return NULL;

    PyObject *errors = NULL;

    for (Py_ssize_t i = 0; i < ms->n_fields; i++) {
        CompiledFieldSpec *fs = &ms->specs[i];

        // --- Extract value from kwargs ---
        PyObject *value = NULL;
        if (fs->alias_obj != Py_None) {
            value = PyDict_GetItem(kwargs, fs->alias_obj);
        }
        if (!value) {
            value = _PyDict_GetItem_KnownHash(kwargs, fs->name_obj, fs->name_hash);
        }

        if (!value) {
            if (!fs->required) {
                PyDict_SetItem(obj_dict, fs->name_obj, fs->default_val);
                continue;
            }
            if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
            PyObject *err = Py_BuildValue("(Os)", fs->name_obj, "Field required");
            PyList_Append(errors, err); Py_DECREF(err);
            continue;
        }

        // --- TYPE CHECKING (using pre-parsed type_code) ---
        PyObject *result = value;
        Py_INCREF(result);
        const char *field_name = NULL;  // lazy-extracted on error

        if (fs->type_code == 1) { // int
            if (fs->strict) {
                if (!PyLong_CheckExact(result) || PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected exactly int, got %s", field_name, Py_TYPE(value)->tp_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
            } else {
                if (PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected int, got bool", field_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
                if (!PyLong_Check(result)) {
                    if (PyFloat_Check(result)) {
                        PyObject *new_val = PyNumber_Long(result);
                        if (!new_val) { Py_DECREF(result); PyErr_Clear();
                            field_name = PyUnicode_AsUTF8(fs->name_obj);
                            if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                            PyObject *msg = PyUnicode_FromFormat("%s: Cannot convert float to int", field_name);
                            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                            PyList_Append(errors, err); Py_DECREF(err); continue;
                        }
                        Py_DECREF(result); result = new_val;
                    } else {
                        Py_DECREF(result);
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                        PyObject *msg = PyUnicode_FromFormat("%s: Expected int, got %s", field_name, Py_TYPE(value)->tp_name);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                        PyList_Append(errors, err); Py_DECREF(err); continue;
                    }
                }
            }
        } else if (fs->type_code == 2) { // float
            if (fs->strict) {
                if (!PyFloat_CheckExact(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected exactly float, got %s", field_name, Py_TYPE(value)->tp_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
            } else {
                if (PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected float, got bool", field_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
                if (!PyFloat_Check(result)) {
                    if (PyLong_Check(result)) {
                        PyObject *new_val = PyNumber_Float(result);
                        if (!new_val) { Py_DECREF(result); PyErr_Clear();
                            field_name = PyUnicode_AsUTF8(fs->name_obj);
                            if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                            PyObject *msg = PyUnicode_FromFormat("%s: Cannot convert int to float", field_name);
                            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                            PyList_Append(errors, err); Py_DECREF(err); continue;
                        }
                        Py_DECREF(result); result = new_val;
                    } else {
                        Py_DECREF(result);
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                        PyObject *msg = PyUnicode_FromFormat("%s: Expected float, got %s", field_name, Py_TYPE(value)->tp_name);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                        PyList_Append(errors, err); Py_DECREF(err); continue;
                    }
                }
            }
        } else if (fs->type_code == 3) { // str
            if (!PyUnicode_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected str, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        } else if (fs->type_code == 4) { // bool
            if (!PyBool_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected bool, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        } else if (fs->type_code == 5) { // bytes
            if (!PyBytes_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected bytes, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        }

        // --- STRING TRANSFORMS ---
        if (PyUnicode_Check(result)) {
            if (fs->strip_ws) {
                PyObject *s = PyObject_CallMethod(result, "strip", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
            if (fs->to_lower) {
                PyObject *s = PyObject_CallMethod(result, "lower", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
            if (fs->to_upper) {
                PyObject *s = PyObject_CallMethod(result, "upper", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
        }

        // --- NUMERIC CONSTRAINTS (direct C struct access, no PyLong_AsLong) ---
        int validation_failed = 0;
        if (PyLong_Check(result) && !PyBool_Check(result)) {
            long val = PyLong_AsLong(result);
            if (fs->has_gt && !satya_validate_int_gt(val, fs->gt_long)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be > %ld, got %ld", field_name, fs->gt_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_ge && !satya_validate_int_gte(val, fs->ge_long)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be >= %ld, got %ld", field_name, fs->ge_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_lt && !satya_validate_int_lt(val, fs->lt_long)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be < %ld, got %ld", field_name, fs->lt_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_le && !satya_validate_int_lte(val, fs->le_long)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be <= %ld, got %ld", field_name, fs->le_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_mul && !satya_validate_int_multiple_of(val, fs->mul_long)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be a multiple of %ld, got %ld", field_name, fs->mul_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        } else if (PyFloat_Check(result)) {
            double val = PyFloat_AsDouble(result);
            if (!fs->allow_inf_nan && !satya_validate_float_finite(val)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be finite", field_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_gt && !satya_validate_float_gt(val, fs->gt_dbl)) { validation_failed = 1; }
            if (!validation_failed && fs->has_ge && !satya_validate_float_gte(val, fs->ge_dbl)) { validation_failed = 2; }
            if (!validation_failed && fs->has_lt && !satya_validate_float_lt(val, fs->lt_dbl)) { validation_failed = 3; }
            if (!validation_failed && fs->has_le && !satya_validate_float_lte(val, fs->le_dbl)) { validation_failed = 4; }
            if (!validation_failed && fs->has_mul) {
                double remainder = fmod(val, fs->mul_dbl);
                if (remainder != 0.0 && fabs(remainder) > 1e-9) { validation_failed = 5; }
            }
            if (validation_failed) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                char buf[128];
                switch (validation_failed) {
                    case 1: snprintf(buf, sizeof(buf), "%s: Value must be > %g, got %g", field_name, fs->gt_dbl, val); break;
                    case 2: snprintf(buf, sizeof(buf), "%s: Value must be >= %g, got %g", field_name, fs->ge_dbl, val); break;
                    case 3: snprintf(buf, sizeof(buf), "%s: Value must be < %g, got %g", field_name, fs->lt_dbl, val); break;
                    case 4: snprintf(buf, sizeof(buf), "%s: Value must be <= %g, got %g", field_name, fs->le_dbl, val); break;
                    case 5: snprintf(buf, sizeof(buf), "%s: Value must be a multiple of %g, got %g", field_name, fs->mul_dbl, val); break;
                }
                PyObject *msg = PyUnicode_FromString(buf);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- LENGTH CONSTRAINTS (pre-parsed min_len/max_len) ---
        if (fs->has_minl || fs->has_maxl) {
            Py_ssize_t length = PyObject_Length(result);
            if (length == -1 && PyErr_Occurred()) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
            if (fs->has_minl && length < fs->min_len) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Length must be >= %zd, got %zd", field_name, fs->min_len, length);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_maxl && length > fs->max_len) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Length must be <= %zd, got %zd", field_name, fs->max_len, length);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- FORMAT VALIDATION ---
        if (fs->format_code > 0 && PyUnicode_Check(result)) {
            const char *str_val = PyUnicode_AsUTF8(result);
            if (!str_val) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
            int valid = 1;
            const char *fmt_name = "unknown";
            switch (fs->format_code) {
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
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Invalid %s format", field_name, fmt_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- SUCCESS: set in __dict__ ---
        PyDict_SetItem(obj_dict, fs->name_obj, result);
        Py_DECREF(result);
    }

    Py_DECREF(obj_dict);
    if (errors && PyList_GET_SIZE(errors) > 0) return errors;
    Py_XDECREF(errors);
    Py_RETURN_NONE;
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

// =============================================================================
// dump_json_compiled: Ultra-fast JSON serialization using pre-compiled specs
// Builds JSON string directly in C, no intermediate Python dict
// =============================================================================

// Helper: escape a string for JSON and append to buffer
static int json_escape_string(char **buf, size_t *buf_size, size_t *pos, const char *str, Py_ssize_t len) {
    // Worst case: every char needs escaping (\uXXXX = 6 chars) + quotes
    size_t needed = *pos + len * 6 + 3;
    if (needed > *buf_size) {
        size_t new_size = needed * 2;
        char *new_buf = realloc(*buf, new_size);
        if (!new_buf) return -1;
        *buf = new_buf;
        *buf_size = new_size;
    }

    char *p = *buf + *pos;
    *p++ = '"';

    for (Py_ssize_t i = 0; i < len; i++) {
        unsigned char c = (unsigned char)str[i];
        switch (c) {
            case '"':  *p++ = '\\'; *p++ = '"'; break;
            case '\\': *p++ = '\\'; *p++ = '\\'; break;
            case '\b': *p++ = '\\'; *p++ = 'b'; break;
            case '\f': *p++ = '\\'; *p++ = 'f'; break;
            case '\n': *p++ = '\\'; *p++ = 'n'; break;
            case '\r': *p++ = '\\'; *p++ = 'r'; break;
            case '\t': *p++ = '\\'; *p++ = 't'; break;
            default:
                if (c < 32) {
                    p += sprintf(p, "\\u%04x", c);
                } else {
                    *p++ = c;
                }
        }
    }

    *p++ = '"';
    *pos = p - *buf;
    return 0;
}

// Helper: append raw string to buffer
static int json_append(char **buf, size_t *buf_size, size_t *pos, const char *str, size_t len) {
    size_t needed = *pos + len + 1;
    if (needed > *buf_size) {
        size_t new_size = needed * 2;
        char *new_buf = realloc(*buf, new_size);
        if (!new_buf) return -1;
        *buf = new_buf;
        *buf_size = new_size;
    }
    memcpy(*buf + *pos, str, len);
    *pos += len;
    return 0;
}

// =============================================================================
// init_model_full: ULTRA-OPTIMIZED init that handles EVERYTHING in C
// Uses METH_FASTCALL for faster argument passing (no tuple unpacking)
// Eliminates consumed set tracking for better performance
// Returns: None on success, list of (field, msg) tuples on error
// Sets __pydantic_fields_set__, __pydantic_private__, __pydantic_extra__ in C
// =============================================================================
static PyObject* py_init_model_full(PyObject* self_unused, PyObject *const *args, Py_ssize_t nargs) {
    // METH_FASTCALL: args passed as C array - no PyArg_ParseTuple overhead!
    if (nargs != 4) {
        PyErr_SetString(PyExc_TypeError, "init_model_full requires 4 arguments");
        return NULL;
    }

    PyObject *model_self = args[0];
    PyObject *kwargs = args[1];
    PyObject *capsule = args[2];
    PyObject *extra_mode_obj = args[3];

    // Validate kwargs is a dict (fast check)
    if (!PyDict_Check(kwargs)) {
        PyErr_SetString(PyExc_TypeError, "kwargs must be a dict");
        return NULL;
    }

    // Get extra_mode as C int (0=ignore, 1=forbid, 2=allow)
    int extra_mode = (int)PyLong_AsLong(extra_mode_obj);
    if (extra_mode == -1 && PyErr_Occurred()) return NULL;

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) return NULL;

    PyObject *obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) return NULL;

    PyObject *errors = NULL;

    // OPTIMIZATION: Use bitmask instead of PySet during hot loop
    // PySet_Add has overhead; bitmask is O(1) bit operation
    // We create the actual PySet only at the end
    uint64_t fields_bitmask = 0;  // Supports up to 64 fields (more than enough)

    // OPTIMIZATION: Use counter instead of consumed set for extra field detection
    Py_ssize_t found_count = 0;
    Py_ssize_t kwargs_size = PyDict_Size(kwargs);

    for (Py_ssize_t i = 0; i < ms->n_fields; i++) {
        CompiledFieldSpec *fs = &ms->specs[i];

        // --- Extract value from kwargs ---
        PyObject *value = NULL;

        if (fs->alias_obj != Py_None) {
            value = PyDict_GetItem(kwargs, fs->alias_obj);
        }
        if (!value) {
            value = _PyDict_GetItem_KnownHash(kwargs, fs->name_obj, fs->name_hash);
        }

        if (!value) {
            if (!fs->required) {
                PyDict_SetItem(obj_dict, fs->name_obj, fs->default_val);
                continue;
            }
            if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
            PyObject *err = Py_BuildValue("(Os)", fs->name_obj, "Field required");
            PyList_Append(errors, err); Py_DECREF(err);
            continue;
        }

        // OPTIMIZATION: Use bitmask instead of PySet_Add (O(1) bit op vs hash table)
        found_count++;
        fields_bitmask |= ((uint64_t)1 << i);

        // --- TYPE CHECKING (same as init_model_compiled) ---
        PyObject *result = value;
        Py_INCREF(result);
        const char *field_name = NULL;

        if (fs->type_code == 1) { // int
            if (fs->strict) {
                if (!PyLong_CheckExact(result) || PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected exactly int, got %s", field_name, Py_TYPE(value)->tp_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
            } else {
                if (PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected int, got bool", field_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
                if (!PyLong_Check(result)) {
                    if (PyFloat_Check(result)) {
                        PyObject *new_val = PyNumber_Long(result);
                        if (!new_val) { Py_DECREF(result); PyErr_Clear();
                            field_name = PyUnicode_AsUTF8(fs->name_obj);
                            if (!errors) { errors = PyList_New(0); }
                            PyObject *msg = PyUnicode_FromFormat("%s: Cannot convert float to int", field_name);
                            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                            PyList_Append(errors, err); Py_DECREF(err); continue;
                        }
                        Py_DECREF(result); result = new_val;
                    } else {
                        Py_DECREF(result);
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); }
                        PyObject *msg = PyUnicode_FromFormat("%s: Expected int, got %s", field_name, Py_TYPE(value)->tp_name);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                        PyList_Append(errors, err); Py_DECREF(err); continue;
                    }
                }
            }
        } else if (fs->type_code == 2) { // float
            if (fs->strict) {
                if (!PyFloat_CheckExact(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected exactly float, got %s", field_name, Py_TYPE(value)->tp_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
            } else {
                if (PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected float, got bool", field_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
                if (!PyFloat_Check(result)) {
                    if (PyLong_Check(result)) {
                        PyObject *new_val = PyNumber_Float(result);
                        if (!new_val) { Py_DECREF(result); PyErr_Clear();
                            field_name = PyUnicode_AsUTF8(fs->name_obj);
                            if (!errors) { errors = PyList_New(0); }
                            PyObject *msg = PyUnicode_FromFormat("%s: Cannot convert int to float", field_name);
                            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                            PyList_Append(errors, err); Py_DECREF(err); continue;
                        }
                        Py_DECREF(result); result = new_val;
                    } else {
                        Py_DECREF(result);
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); }
                        PyObject *msg = PyUnicode_FromFormat("%s: Expected float, got %s", field_name, Py_TYPE(value)->tp_name);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                        PyList_Append(errors, err); Py_DECREF(err); continue;
                    }
                }
            }
        } else if (fs->type_code == 3) { // str
            if (!PyUnicode_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected str, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        } else if (fs->type_code == 4) { // bool
            if (!PyBool_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected bool, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        } else if (fs->type_code == 5) { // bytes
            if (!PyBytes_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected bytes, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        } else if (fs->type_code == 6) { // nested model - FAST PATH
            // Check if value is already the correct nested model type
            if ((PyObject*)Py_TYPE(result) == fs->nested_model_type) {
                // Already validated! Just set directly in dict (ULTRA FAST)
                PyDict_SetItem(obj_dict, fs->name_obj, result);
                Py_DECREF(result);
                continue;  // Skip all other validation - already done
            }
            // Check if value is dict - need to create nested model
            if (PyDict_Check(result)) {
                // Ensure global empty tuple is initialized
                if (!g_empty_tuple) {
                    g_empty_tuple = PyTuple_New(0);
                    if (!g_empty_tuple) {
                        Py_DECREF(result);
                        Py_DECREF(obj_dict);
                        Py_XDECREF(errors);
                        return NULL;
                    }
                }
                // Create nested model: type(**dict)
                PyObject *nested_obj = PyObject_Call(fs->nested_model_type, g_empty_tuple, result);
                Py_DECREF(result);  // Done with dict
                if (!nested_obj) {
                    // Nested validation failed - extract error
                    PyObject *exc_type, *exc_value, *exc_tb;
                    PyErr_Fetch(&exc_type, &exc_value, &exc_tb);
                    if (exc_value) {
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); }
                        PyObject *err_str = PyObject_Str(exc_value);
                        PyObject *msg = PyUnicode_FromFormat("%s: %S", field_name, err_str);
                        Py_XDECREF(err_str);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
                        Py_DECREF(msg);
                        PyList_Append(errors, err);
                        Py_DECREF(err);
                    }
                    Py_XDECREF(exc_type);
                    Py_XDECREF(exc_value);
                    Py_XDECREF(exc_tb);
                    continue;
                }
                // Set nested model in dict
                PyDict_SetItem(obj_dict, fs->name_obj, nested_obj);
                Py_DECREF(nested_obj);
                continue;  // Skip all other validation - nested __init__ did it
            }
            // Value is neither correct type nor dict - error
            Py_DECREF(result);
            field_name = PyUnicode_AsUTF8(fs->name_obj);
            if (!errors) { errors = PyList_New(0); }
            const char *expected_name = ((PyTypeObject*)fs->nested_model_type)->tp_name;
            PyObject *msg = PyUnicode_FromFormat("%s: Expected %s or dict, got %s",
                field_name, expected_name, Py_TYPE(value)->tp_name);
            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
            Py_DECREF(msg);
            PyList_Append(errors, err);
            Py_DECREF(err);
            continue;
        }

        // --- STRING TRANSFORMS (inline for speed) ---
        if (PyUnicode_Check(result)) {
            if (fs->strip_ws) {
                PyObject *s = PyObject_CallMethod(result, "strip", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
            if (fs->to_lower) {
                PyObject *s = PyObject_CallMethod(result, "lower", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
            if (fs->to_upper) {
                PyObject *s = PyObject_CallMethod(result, "upper", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
        }

        // --- NUMERIC CONSTRAINTS ---
        int validation_failed = 0;
        if (PyLong_Check(result) && !PyBool_Check(result)) {
            long val = PyLong_AsLong(result);
            if (fs->has_gt && !satya_validate_int_gt(val, fs->gt_long)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be > %ld, got %ld", field_name, fs->gt_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_ge && !satya_validate_int_gte(val, fs->ge_long)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be >= %ld, got %ld", field_name, fs->ge_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_lt && !satya_validate_int_lt(val, fs->lt_long)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be < %ld, got %ld", field_name, fs->lt_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_le && !satya_validate_int_lte(val, fs->le_long)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be <= %ld, got %ld", field_name, fs->le_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_mul && !satya_validate_int_multiple_of(val, fs->mul_long)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be a multiple of %ld, got %ld", field_name, fs->mul_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        } else if (PyFloat_Check(result)) {
            double val = PyFloat_AsDouble(result);
            if (!fs->allow_inf_nan && !satya_validate_float_finite(val)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be finite", field_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_gt && !satya_validate_float_gt(val, fs->gt_dbl)) { validation_failed = 1; }
            if (!validation_failed && fs->has_ge && !satya_validate_float_gte(val, fs->ge_dbl)) { validation_failed = 2; }
            if (!validation_failed && fs->has_lt && !satya_validate_float_lt(val, fs->lt_dbl)) { validation_failed = 3; }
            if (!validation_failed && fs->has_le && !satya_validate_float_lte(val, fs->le_dbl)) { validation_failed = 4; }
            if (!validation_failed && fs->has_mul) {
                double remainder = fmod(val, fs->mul_dbl);
                if (remainder != 0.0 && fabs(remainder) > 1e-9) { validation_failed = 5; }
            }
            if (validation_failed) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                char buf[128];
                switch (validation_failed) {
                    case 1: snprintf(buf, sizeof(buf), "%s: Value must be > %g, got %g", field_name, fs->gt_dbl, val); break;
                    case 2: snprintf(buf, sizeof(buf), "%s: Value must be >= %g, got %g", field_name, fs->ge_dbl, val); break;
                    case 3: snprintf(buf, sizeof(buf), "%s: Value must be < %g, got %g", field_name, fs->lt_dbl, val); break;
                    case 4: snprintf(buf, sizeof(buf), "%s: Value must be <= %g, got %g", field_name, fs->le_dbl, val); break;
                    case 5: snprintf(buf, sizeof(buf), "%s: Value must be a multiple of %g, got %g", field_name, fs->mul_dbl, val); break;
                }
                PyObject *msg = PyUnicode_FromString(buf);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- LENGTH CONSTRAINTS ---
        if (fs->has_minl || fs->has_maxl) {
            Py_ssize_t length = PyObject_Length(result);
            if (length == -1 && PyErr_Occurred()) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
            if (fs->has_minl && length < fs->min_len) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Length must be >= %zd, got %zd", field_name, fs->min_len, length);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_maxl && length > fs->max_len) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Length must be <= %zd, got %zd", field_name, fs->max_len, length);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- FORMAT VALIDATION ---
        if (fs->format_code > 0 && PyUnicode_Check(result)) {
            const char *str_val = PyUnicode_AsUTF8(result);
            if (!str_val) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
            int valid = 1;
            const char *fmt_name = "unknown";
            switch (fs->format_code) {
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
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Invalid %s format", field_name, fmt_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- SUCCESS: set in __dict__ ---
        PyDict_SetItem(obj_dict, fs->name_obj, result);
        Py_DECREF(result);
    }

    // --- HANDLE EXTRA FIELDS (OPTIMIZED: no consumed set) ---
    PyObject *extra_data = NULL;
    // Only check for extras if we found fewer fields than kwargs has
    // This is the common case optimization - most models don't have extra fields
    if (extra_mode != 0 && found_count < kwargs_size) {
        PyObject *key, *value;
        Py_ssize_t pos = 0;
        while (PyDict_Next(kwargs, &pos, &key, &value)) {
            // Check if this key is a known field (by name or alias)
            int is_known = 0;
            for (Py_ssize_t i = 0; i < ms->n_fields && !is_known; i++) {
                CompiledFieldSpec *fs = &ms->specs[i];
                if (PyObject_RichCompareBool(key, fs->name_obj, Py_EQ) == 1) {
                    is_known = 1;
                } else if (fs->alias_obj != Py_None &&
                           PyObject_RichCompareBool(key, fs->alias_obj, Py_EQ) == 1) {
                    is_known = 1;
                }
            }
            if (!is_known) {
                if (extra_mode == 1) {  // 'forbid'
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *err = Py_BuildValue("(Os)", key, "Extra inputs are not permitted");
                    PyList_Append(errors, err); Py_DECREF(err);
                } else if (extra_mode == 2) {  // 'allow'
                    if (!extra_data) { extra_data = PyDict_New(); }
                    PyDict_SetItem(extra_data, key, value);
                }
            }
        }
    }

    Py_DECREF(obj_dict);

    // --- SET PYDANTIC INTERNAL ATTRIBUTES (direct __dict__ access for speed) ---
    // Re-get obj_dict since we released it earlier
    obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) { Py_XDECREF(extra_data); Py_XDECREF(errors); return NULL; }

    // Use interned strings for fast dict access
    static PyObject *fields_set_key = NULL;
    static PyObject *extra_key = NULL;
    static PyObject *private_key = NULL;
    if (!fields_set_key) {
        fields_set_key = PyUnicode_InternFromString("__pydantic_fields_set__");
        extra_key = PyUnicode_InternFromString("__pydantic_extra__");
        private_key = PyUnicode_InternFromString("__pydantic_private__");
    }

    // OPTIMIZATION: Create PySet from bitmask only once at the end
    // This is faster than calling PySet_Add for each field during the loop
    PyObject *fields_set = PySet_New(NULL);
    if (!fields_set) { Py_DECREF(obj_dict); Py_XDECREF(extra_data); Py_XDECREF(errors); return NULL; }
    for (Py_ssize_t i = 0; i < ms->n_fields; i++) {
        if (fields_bitmask & ((uint64_t)1 << i)) {
            PySet_Add(fields_set, ms->specs[i].name_obj);
        }
    }

    PyDict_SetItem(obj_dict, fields_set_key, fields_set);
    Py_DECREF(fields_set);

    if (extra_data) {
        PyDict_SetItem(obj_dict, extra_key, extra_data);
        Py_DECREF(extra_data);
    } else {
        PyDict_SetItem(obj_dict, extra_key, Py_None);
    }
    PyDict_SetItem(obj_dict, private_key, Py_None);
    Py_DECREF(obj_dict);

    if (errors && PyList_GET_SIZE(errors) > 0) return errors;
    Py_XDECREF(errors);
    Py_RETURN_NONE;
}

// =============================================================================
// dump_model_compiled: Ultra-fast dict dump using pre-compiled specs
// Returns Python dict directly without intermediate processing
// =============================================================================
static PyObject* py_dump_model_compiled(PyObject* self_unused, PyObject* args) {
    PyObject *model_self, *capsule;

    if (!PyArg_ParseTuple(args, "OO", &model_self, &capsule)) {
        return NULL;
    }

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) return NULL;

    PyObject *obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) return NULL;

    // Pre-allocate result dict with exact size
    PyObject *result = _PyDict_NewPresized(ms->n_fields);
    if (!result) { Py_DECREF(obj_dict); return NULL; }

    for (Py_ssize_t i = 0; i < ms->n_fields; i++) {
        CompiledFieldSpec *fs = &ms->specs[i];
        PyObject *value = PyDict_GetItem(obj_dict, fs->name_obj);
        if (!value) continue;

        // Direct copy - values are already validated
        // Note: For nested models, Python caller will need to recurse
        PyDict_SetItem(result, fs->name_obj, value);
    }

    Py_DECREF(obj_dict);
    return result;
}

static PyObject* py_dump_json_compiled(PyObject* self_unused, PyObject* args) {
    PyObject *model_self, *capsule;

    if (!PyArg_ParseTuple(args, "OO", &model_self, &capsule)) {
        return NULL;
    }

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) return NULL;

    PyObject *obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) return NULL;

    // Initial buffer
    size_t buf_size = 256;
    char *buf = malloc(buf_size);
    if (!buf) { Py_DECREF(obj_dict); return PyErr_NoMemory(); }
    size_t pos = 0;

    buf[pos++] = '{';

    int first = 1;
    for (Py_ssize_t i = 0; i < ms->n_fields; i++) {
        CompiledFieldSpec *fs = &ms->specs[i];
        PyObject *value = PyDict_GetItem(obj_dict, fs->name_obj);
        if (!value) continue;

        // Comma separator
        if (!first) {
            if (json_append(&buf, &buf_size, &pos, ", ", 2) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        }
        first = 0;

        // Field name
        const char *field_name = PyUnicode_AsUTF8(fs->name_obj);
        Py_ssize_t name_len = strlen(field_name);
        if (json_escape_string(&buf, &buf_size, &pos, field_name, name_len) < 0) {
            free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
        }
        if (json_append(&buf, &buf_size, &pos, ": ", 2) < 0) {
            free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
        }

        // Value serialization
        if (value == Py_None) {
            if (json_append(&buf, &buf_size, &pos, "null", 4) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        } else if (PyBool_Check(value)) {
            if (value == Py_True) {
                if (json_append(&buf, &buf_size, &pos, "true", 4) < 0) {
                    free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
                }
            } else {
                if (json_append(&buf, &buf_size, &pos, "false", 5) < 0) {
                    free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
                }
            }
        } else if (PyLong_Check(value)) {
            long val = PyLong_AsLong(value);
            char num_buf[32];
            int num_len = snprintf(num_buf, sizeof(num_buf), "%ld", val);
            if (json_append(&buf, &buf_size, &pos, num_buf, num_len) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        } else if (PyFloat_Check(value)) {
            double val = PyFloat_AsDouble(value);
            char num_buf[64];
            int num_len;
            // Handle special floats
            if (isinf(val)) {
                num_len = snprintf(num_buf, sizeof(num_buf), "null"); // JSON doesn't support Infinity
            } else if (isnan(val)) {
                num_len = snprintf(num_buf, sizeof(num_buf), "null"); // JSON doesn't support NaN
            } else {
                num_len = snprintf(num_buf, sizeof(num_buf), "%.17g", val);
            }
            if (json_append(&buf, &buf_size, &pos, num_buf, num_len) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        } else if (PyUnicode_Check(value)) {
            Py_ssize_t str_len;
            const char *str = PyUnicode_AsUTF8AndSize(value, &str_len);
            if (!str) { free(buf); Py_DECREF(obj_dict); return NULL; }
            if (json_escape_string(&buf, &buf_size, &pos, str, str_len) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        } else if (PyBytes_Check(value)) {
            // Encode bytes as base64 or just the raw bytes as string
            Py_ssize_t bytes_len = PyBytes_GET_SIZE(value);
            const char *bytes_data = PyBytes_AS_STRING(value);
            if (json_escape_string(&buf, &buf_size, &pos, bytes_data, bytes_len) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        } else {
            // Fallback: use Python's repr or str
            PyObject *str_obj = PyObject_Str(value);
            if (!str_obj) { free(buf); Py_DECREF(obj_dict); return NULL; }
            Py_ssize_t str_len;
            const char *str = PyUnicode_AsUTF8AndSize(str_obj, &str_len);
            if (!str) { Py_DECREF(str_obj); free(buf); Py_DECREF(obj_dict); return NULL; }
            if (json_escape_string(&buf, &buf_size, &pos, str, str_len) < 0) {
                Py_DECREF(str_obj); free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
            Py_DECREF(str_obj);
        }
    }

    buf[pos++] = '}';

    Py_DECREF(obj_dict);

    PyObject *result = PyUnicode_FromStringAndSize(buf, pos);
    free(buf);
    return result;
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
    {"compile_model_specs", py_compile_model_specs, METH_VARARGS,
     "Pre-compile field specs into C structs: (specs_tuple) -> PyCapsule"},
    {"init_model_compiled", py_init_model_compiled, METH_VARARGS,
     "Ultra-fast init with pre-compiled specs: (self, kwargs, capsule) -> None or errors"},
    {"init_model_full", (PyCFunction)py_init_model_full, METH_FASTCALL,
     "Full native init: (self, kwargs, capsule, extra_mode) -> None or errors. Sets all pydantic attrs."},
    {"dump_model_compiled", py_dump_model_compiled, METH_VARARGS,
     "Ultra-fast model_dump with pre-compiled specs: (self, capsule) -> dict"},
    {"dump_json_compiled", py_dump_json_compiled, METH_VARARGS,
     "Ultra-fast JSON dump with pre-compiled specs: (self, capsule) -> JSON string"},
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
