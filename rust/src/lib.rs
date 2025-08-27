use wasm_bindgen::prelude::*;
use js_sys::{Array, Object, Reflect};
use std::collections::HashMap;

const CHUNK_SIZE: usize = 65536;  // Maximum chunk size for optimal cache usage

#[wasm_bindgen(start)]
pub fn init() {
    // Initialize WASM module
}

#[wasm_bindgen]
pub struct DhiCore {
    schema: HashMap<String, FieldValidator>,
    batch_size: i32,
    custom_types: HashMap<String, HashMap<String, FieldValidator>>,
    debug: bool,
    // Cached analysis for fast path decisions
    has_complex_types: bool,
    is_strict_primitive_schema: bool,
    // Flattened fast path data
    strict_fields: Vec<(JsValue, u8)>, // (key, type_tag)
    fast_fields: Vec<(JsValue, FieldType)>, // for non-strict fast path
}

#[derive(Debug, Clone)]
struct FieldValidator {
    field_type: FieldType,
    required: bool,
    // Cached JS property key to avoid rebuilding JsValue for field names
    key: JsValue,
}

#[derive(Debug, Clone)]
enum FieldType {
    String,
    Number,
    Boolean,
    Array(Box<FieldType>),
    Object(HashMap<String, FieldValidator>),
    Custom(String),
    Any,
    Record(Box<FieldType>),
    Date,
    BigInt,      // Add BigInt
    Symbol,      // Add Symbol
    Undefined,   // Add Undefined
    Null,        // Add Null
    Void,        // Add Void
    Unknown,     // Add Unknown
    Never,       // Add Never
    Enum(Vec<String>),  // Add Enum type
}

#[wasm_bindgen]
impl DhiCore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        DhiCore {
            schema: HashMap::new(),
            batch_size: 1000,
            custom_types: HashMap::new(),
            debug: false,
            has_complex_types: false,
            is_strict_primitive_schema: false,
            strict_fields: Vec::new(),
            fast_fields: Vec::new(),
        }
    }

    #[wasm_bindgen]
    pub fn get_batch_size(&self) -> i32 {
        self.batch_size
    }

    #[wasm_bindgen]
    pub fn set_batch_size(&mut self, size: i32) {
        self.batch_size = size;
    }

    #[wasm_bindgen]
    pub fn define_custom_type(&mut self, type_name: String) -> Result<(), JsValue> {
        if !self.custom_types.contains_key(&type_name) {
            self.custom_types.insert(type_name, HashMap::new());
        }
        Ok(())
    }

    #[wasm_bindgen]
    pub fn add_field_to_custom_type(
        &mut self,
        type_name: String,
        field_name: String,
        field_type: String,
        required: bool,
    ) -> Result<(), JsValue> {
        let parsed_field_type = self.parse_field_type(&field_type)?;
        
        let custom_type = self.custom_types.get_mut(&type_name)
            .ok_or_else(|| JsValue::from_str("Custom type not defined"))?;

        let key = JsValue::from_str(&field_name);
        custom_type.insert(field_name, FieldValidator {
            field_type: parsed_field_type,
            required,
            key,
        });
        Ok(())
    }

    #[wasm_bindgen]
    pub fn add_field(&mut self, name: String, field_type: String, required: bool) -> Result<(), JsValue> {
        let field_type = self.parse_field_type(&field_type)?;
        let key = JsValue::from_str(&name);
        self.schema.insert(name, FieldValidator { field_type, required, key });
        self.invalidate_cache();
        Ok(())
    }

    // New method to add nested object
    #[wasm_bindgen]
    pub fn add_object_field(&mut self, name: String, required: bool) -> Result<(), JsValue> {
        let key = JsValue::from_str(&name);
        self.schema.insert(name, FieldValidator { 
            field_type: FieldType::Object(HashMap::new()),
            required,
            key,
        });
        self.invalidate_cache();
        Ok(())
    }

    // New method to add field to nested object
    #[wasm_bindgen]
    pub fn add_nested_field(&mut self, object_path: String, field_name: String, field_type: String, required: bool) -> Result<(), JsValue> {
        // Parse field type first to avoid borrow checker issue
        let parsed_field_type = self.parse_field_type(&field_type)?;
        
        if object_path.is_empty() {
            // If no path, add directly to root schema
            let key = JsValue::from_str(&field_name);
            self.schema.insert(field_name, FieldValidator { 
                field_type: parsed_field_type, 
                required,
                key,
            });
            self.invalidate_cache();
            return Ok(());
        }

        let parts: Vec<&str> = object_path.split('.').collect();
        let mut current_schema = &mut self.schema;

        // Navigate to the correct nested object
        for part in parts {
            if let Some(FieldValidator { field_type: FieldType::Object(ref mut nested_schema), .. }) = current_schema.get_mut(part) {
                current_schema = nested_schema;
            } else {
                return Err(JsValue::from_str("Invalid object path"));
            }
        }

        // Add the field to the nested object
        let key = JsValue::from_str(&field_name);
        current_schema.insert(field_name, FieldValidator { 
            field_type: parsed_field_type, 
            required,
            key,
        });
        self.invalidate_cache();
        Ok(())
    }

    #[wasm_bindgen]
    pub fn validate(&self, value: JsValue) -> Result<bool, JsValue> {
        Ok(self.validate_value_internal(&value))
    }

    fn invalidate_cache(&mut self) {
        // Recompute cached analysis
        self.has_complex_types = self.schema.values().any(|v| {
            matches!(v.field_type, FieldType::Object(_) | FieldType::Array(_) | FieldType::Custom(_))
        });
        
        self.is_strict_primitive_schema = !self.has_complex_types && 
            self.schema.values().all(|v| v.required && 
                matches!(v.field_type, FieldType::String | FieldType::Number | FieldType::Boolean));
        
        // Rebuild flattened data structures
        if self.is_strict_primitive_schema {
            self.strict_fields = self.schema.iter()
                .map(|(_k, v)| {
                    let tag = match v.field_type {
                        FieldType::String => 0u8,
                        FieldType::Number => 1u8,
                        FieldType::Boolean => 2u8,
                        _ => 255u8,
                    };
                    (v.key.clone(), tag)
                })
                .collect();
        } else {
            self.strict_fields.clear();
        }
        
        if !self.has_complex_types {
            self.fast_fields = self.schema.iter()
                .map(|(_k, v)| (v.key.clone(), v.field_type.clone()))
                .collect();
        } else {
            self.fast_fields.clear();
        }
    }

    #[wasm_bindgen]
    pub fn validate_batch(&self, items: Array) -> Result<Array, JsValue> {
        let len = items.length() as usize;
        let results = Array::new_with_length(len as u32);
        
        if self.is_strict_primitive_schema {
            // OPTIMIZED PATH: Simple primitive validation
            for i in 0..len {
                let item = items.get(i as u32);
                let Some(obj) = item.dyn_ref::<Object>() else {
                    results.set(i as u32, JsValue::from_bool(false));
                    continue;
                };

                let mut valid = true;
                for (field_name, tag) in &self.strict_fields {
                    let Ok(value) = Reflect::get(obj, field_name) else {
                        valid = false;
                        break;
                    };
                    if value.is_undefined() {
                        valid = false;
                        break;
                    }
                    valid = match tag {
                        0 => value.is_string(),
                        1 => value.as_f64().is_some(),
                        2 => value.as_bool().is_some(),
                        _ => false,
                    };
                    if !valid { break; }
                }
                results.set(i as u32, JsValue::from_bool(valid));
            }
        } else if !self.has_complex_types {
            // FAST PATH for simple non-primitive objects
            for i in 0..len {
                let item = items.get(i as u32);
                let Some(obj) = item.dyn_ref::<Object>() else {
                    results.set(i as u32, JsValue::from_bool(false));
                    continue;
                };

                let mut valid = true;
                for (field_name, field_type) in &self.fast_fields {
                    let Ok(value) = Reflect::get(obj, field_name) else {
                        valid = false;
                        break;
                    };
                    if !self.validate_value_bool(&value, field_type) {
                        valid = false;
                        break;
                    }
                }
                results.set(i as u32, JsValue::from_bool(valid));
            }
        } else {
            // SLOW PATH for complex objects
            // ... existing complex validation code ...
            for chunk_start in (0..len).step_by(CHUNK_SIZE) {
                let chunk_end = (chunk_start + CHUNK_SIZE).min(len);
                for i in chunk_start..chunk_end {
                    let item = items.get(i as u32);
                    let is_valid = self.validate_value_internal(&item);
                    results.set(i as u32, JsValue::from_bool(is_valid));
                }
            }
        }
        
        Ok(results)
    }

    #[wasm_bindgen]
    pub fn set_debug(&mut self, debug: bool) {
        self.debug = debug;
    }

    fn validate_value_internal(&self, value: &JsValue) -> bool {
        if !value.is_object() {
            return false;
        }

        let Some(obj) = value.dyn_ref::<Object>() else {
            return false;
        };

        for (_field_name, validator) in &self.schema {
            match &validator.field_type {
                FieldType::Object(nested_schema) => {
                    // Handle nested object validation
                    let Ok(nested_value) = Reflect::get(obj, &validator.key) else {
                        return false;
                    };
                    if validator.required && nested_value.is_undefined() {
                        return false;
                    }
                    if !nested_value.is_undefined() {
                        if !self.validate_object_bool(&nested_value, nested_schema) {
                            return false;
                        }
                    }
                }
                _ => {
                    // Handle primitive types as before
                    let Ok(field_value) = Reflect::get(obj, &validator.key) else {
                        return false;
                    };
                    if validator.required && field_value.is_undefined() {
                        return false;
                    }
                    if !field_value.is_undefined() {
                        if !self.validate_value_bool(&field_value, &validator.field_type) {
                            return false;
                        }
                    }
                }
            }
        }
        true
    }

    fn validate_object(&self, value: &JsValue, schema: &HashMap<String, FieldValidator>) -> Result<(), JsValue> {
        if self.validate_object_bool(value, schema) {
            Ok(())
        } else {
            Err(JsValue::from_bool(false))
        }
    }

    fn validate_object_bool(&self, value: &JsValue, schema: &HashMap<String, FieldValidator>) -> bool {
        let Some(obj) = value.dyn_ref::<Object>() else {
            return false;
        };

        for (_field_name, validator) in schema {
            let Ok(field_value) = Reflect::get(obj, &validator.key) else {
                return false;
            };
            if validator.required && field_value.is_undefined() {
                return false;
            }
            if !field_value.is_undefined() {
                if !self.validate_value_bool(&field_value, &validator.field_type) {
                    return false;
                }
            }
        }
        true
    }

    fn parse_field_type(&self, field_type: &str) -> Result<FieldType, JsValue> {
        match field_type {
            "string" => Ok(FieldType::String),
            "number" => Ok(FieldType::Number),
            "boolean" => Ok(FieldType::Boolean),
            "object" => Ok(FieldType::Object(HashMap::new())),
            "record" => Ok(FieldType::Record(Box::new(FieldType::Any))),
            "date" => Ok(FieldType::Date),
            "bigint" => Ok(FieldType::BigInt),
            "symbol" => Ok(FieldType::Symbol),
            "undefined" => Ok(FieldType::Undefined),
            "null" => Ok(FieldType::Null),
            "void" => Ok(FieldType::Void),
            "unknown" => Ok(FieldType::Unknown),
            "never" => Ok(FieldType::Never),
            _ => {
                if let Some(values) = field_type.strip_prefix("enum:") {
                    return Ok(FieldType::Enum(
                        values.split(',').map(String::from).collect()
                    ));
                }
                if let Some(inner_type) = field_type.strip_prefix("Array<").and_then(|s| s.strip_suffix(">")) {
                    let inner = self.parse_field_type(inner_type)?;
                    return Ok(FieldType::Array(Box::new(inner)));
                }
                if let Some(inner_type) = field_type.strip_prefix("Record<").and_then(|s| s.strip_suffix(">")) {
                    let inner = self.parse_field_type(inner_type)?;
                    return Ok(FieldType::Record(Box::new(inner)));
                }
                if self.custom_types.contains_key(field_type) {
                    return Ok(FieldType::Custom(field_type.to_string()));
                }
                Err(JsValue::from_str(&format!("Unsupported type: {}", field_type)))
            }
        }
    }

    // Add back validate_value method
    #[inline(always)]
    fn validate_value(&self, value: &JsValue, field_type: &FieldType) -> Result<(), JsValue> {
        if self.validate_value_bool(value, field_type) {
            Ok(())
        } else {
            Err(JsValue::from_bool(false))
        }
    }

    #[inline(always)]
    fn validate_value_bool(&self, value: &JsValue, field_type: &FieldType) -> bool {
        match field_type {
            FieldType::String => value.is_string(),
            FieldType::Number => value.as_f64().is_some(),
            FieldType::Boolean => value.as_bool().is_some(),
            FieldType::Array(item_type) => {
                let Some(array) = value.dyn_ref::<Array>() else {
                    return false;
                };
                
                for i in 0..array.length() {
                    let item = array.get(i);
                    if !self.validate_value_bool(&item, item_type) {
                        return false;
                    }
                }
                true
            }
            FieldType::Object(nested_schema) => {
                self.validate_object_bool(value, nested_schema)
            }
            FieldType::Custom(type_name) => {
                if let Some(custom_type) = self.custom_types.get(type_name) {
                    self.validate_object_bool(value, custom_type)
                } else {
                    true
                }
            }
            FieldType::Record(value_type) => {
                let Some(obj) = value.dyn_ref::<Object>() else {
                    return false;
                };

                // Iterate values directly to avoid building [key, value] pairs
                let values = Object::values(obj);
                for i in 0..values.length() {
                    let v = values.get(i);
                    if !self.validate_value_bool(&v, value_type) {
                        return false;
                    }
                }
                true
            }
            FieldType::Date => value.is_instance_of::<js_sys::Date>(),
            FieldType::BigInt => value.is_bigint(),
            FieldType::Symbol => value.is_symbol(),
            FieldType::Undefined => value.is_undefined(),
            FieldType::Null => value.is_null(),
            FieldType::Void => value.is_undefined(),
            FieldType::Unknown => true, // accepts any value
            FieldType::Never => false, // always fails validation
            FieldType::Any => true,
            FieldType::Enum(allowed_values) => {
                if let Some(str_val) = value.as_string() {
                    allowed_values.contains(&str_val)
                } else {
                    false
                }
            }
        }
    }

    #[wasm_bindgen]
    pub fn set_optional(&mut self, optional: bool) {
        if let Some(last_field) = self.schema.iter_mut().last() {
            last_field.1.required = !optional;
        }
    }

    #[wasm_bindgen]
    pub fn set_nullable(&mut self, nullable: bool) {
        if let Some(last_field) = self.schema.iter_mut().last() {
            // TODO: Implement nullable logic
            last_field.1.required = !nullable;
        }
    }

    #[wasm_bindgen]
    pub fn set_value_type(&mut self, value_type: &str) {
        if let Some(last_field) = self.schema.iter_mut().last() {
            last_field.1.field_type = match value_type {
                "string" => FieldType::String,
                "number" => FieldType::Number,
                "boolean" => FieldType::Boolean,
                // Add other types as needed
                _ => FieldType::Any,
            };
        }
    }
} 