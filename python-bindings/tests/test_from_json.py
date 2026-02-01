"""
Tests for Struct.from_json() and Struct.from_json_batch()
"""

import pytest
from typing import Annotated
from dhi import Struct, Field


class UserStruct(Struct):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: str
    age: Annotated[int, Field(ge=0, le=150)]


class OptionalFieldsStruct(Struct):
    required_field: str
    optional_field: str = "default_value"
    optional_int: int = 42


class NestedTypes(Struct):
    string_field: str
    int_field: int
    float_field: float
    bool_field: bool


class TestFromJson:
    """Tests for Struct.from_json()"""

    def test_basic_parsing(self):
        """Test basic JSON parsing."""
        json_str = '{"name": "John Doe", "email": "john@example.com", "age": 30}'
        user = UserStruct.from_json(json_str)

        assert user.name == "John Doe"
        assert user.email == "john@example.com"
        assert user.age == 30

    def test_bytes_input(self):
        """Test parsing from bytes."""
        json_bytes = b'{"name": "Jane", "email": "jane@example.com", "age": 25}'
        user = UserStruct.from_json(json_bytes)

        assert user.name == "Jane"
        assert user.email == "jane@example.com"
        assert user.age == 25

    def test_unicode_strings(self):
        """Test Unicode in JSON strings."""
        json_str = '{"name": "日本語", "email": "test@example.com", "age": 30}'
        user = UserStruct.from_json(json_str)

        assert user.name == "日本語"

    def test_escaped_strings(self):
        """Test JSON escape sequences."""
        json_str = r'{"name": "John \"Doe\"", "email": "test@example.com", "age": 30}'
        user = UserStruct.from_json(json_str)

        assert user.name == 'John "Doe"'

    def test_newline_escape(self):
        """Test newline escape sequence."""
        json_str = '{"name": "Line1\\nLine2", "email": "test@example.com", "age": 30}'
        user = UserStruct.from_json(json_str)

        assert user.name == "Line1\nLine2"

    def test_tab_escape(self):
        """Test tab escape sequence."""
        json_str = '{"name": "Col1\\tCol2", "email": "test@example.com", "age": 30}'
        user = UserStruct.from_json(json_str)

        assert user.name == "Col1\tCol2"

    def test_optional_fields_present(self):
        """Test with all optional fields present."""
        json_str = '{"required_field": "hello", "optional_field": "custom", "optional_int": 99}'
        obj = OptionalFieldsStruct.from_json(json_str)

        assert obj.required_field == "hello"
        assert obj.optional_field == "custom"
        assert obj.optional_int == 99

    def test_optional_fields_missing(self):
        """Test with optional fields missing (should use defaults)."""
        json_str = '{"required_field": "hello"}'
        obj = OptionalFieldsStruct.from_json(json_str)

        assert obj.required_field == "hello"
        assert obj.optional_field == "default_value"
        assert obj.optional_int == 42

    def test_extra_fields_ignored(self):
        """Test that unknown fields in JSON are ignored."""
        json_str = '{"name": "John", "email": "john@example.com", "age": 30, "unknown_field": "ignored"}'
        user = UserStruct.from_json(json_str)

        assert user.name == "John"
        assert user.email == "john@example.com"
        assert user.age == 30

    def test_type_coercion_int_to_float(self):
        """Test that integers are coerced to floats when needed."""
        json_str = '{"string_field": "test", "int_field": 42, "float_field": 100, "bool_field": true}'
        obj = NestedTypes.from_json(json_str)

        assert obj.float_field == 100.0
        assert isinstance(obj.float_field, float)

    def test_boolean_values(self):
        """Test boolean parsing."""
        json_str = '{"string_field": "test", "int_field": 42, "float_field": 3.14, "bool_field": true}'
        obj = NestedTypes.from_json(json_str)
        assert obj.bool_field is True

        json_str = '{"string_field": "test", "int_field": 42, "float_field": 3.14, "bool_field": false}'
        obj = NestedTypes.from_json(json_str)
        assert obj.bool_field is False

    def test_negative_numbers(self):
        """Test negative number parsing."""
        json_str = '{"string_field": "test", "int_field": -42, "float_field": -3.14, "bool_field": true}'
        obj = NestedTypes.from_json(json_str)

        assert obj.int_field == -42
        assert obj.float_field == pytest.approx(-3.14)

    def test_large_integers(self):
        """Test large integer parsing."""
        json_str = '{"string_field": "test", "int_field": 9999999999, "float_field": 1.0, "bool_field": true}'
        obj = NestedTypes.from_json(json_str)

        assert obj.int_field == 9999999999


class TestFromJsonValidation:
    """Tests for validation in from_json()"""

    def test_missing_required_field(self):
        """Test that missing required fields raise ValueError."""
        json_str = '{"name": "John", "email": "john@example.com"}'  # missing age

        with pytest.raises(ValueError, match="required"):
            UserStruct.from_json(json_str)

    def test_constraint_violation_min_length(self):
        """Test min_length constraint violation."""
        json_str = '{"name": "", "email": "john@example.com", "age": 30}'  # empty name

        with pytest.raises(ValueError, match="[Ll]ength"):
            UserStruct.from_json(json_str)

    def test_constraint_violation_ge(self):
        """Test ge (greater than or equal) constraint violation."""
        json_str = '{"name": "John", "email": "john@example.com", "age": -1}'  # negative age

        with pytest.raises(ValueError):
            UserStruct.from_json(json_str)

    def test_constraint_violation_le(self):
        """Test le (less than or equal) constraint violation."""
        json_str = '{"name": "John", "email": "john@example.com", "age": 200}'  # age > 150

        with pytest.raises(ValueError):
            UserStruct.from_json(json_str)


class TestFromJsonErrors:
    """Tests for error handling in from_json()"""

    def test_invalid_json(self):
        """Test invalid JSON raises ValueError."""
        with pytest.raises(ValueError):
            UserStruct.from_json('not valid json')

    def test_json_array_instead_of_object(self):
        """Test that JSON array raises error when object expected."""
        with pytest.raises(ValueError):
            UserStruct.from_json('[1, 2, 3]')

    def test_unclosed_string(self):
        """Test unclosed string raises error."""
        with pytest.raises(ValueError):
            UserStruct.from_json('{"name": "unclosed')

    def test_unclosed_brace(self):
        """Test unclosed brace raises error."""
        with pytest.raises(ValueError):
            UserStruct.from_json('{"name": "John"')


class TestFromJsonBatch:
    """Tests for Struct.from_json_batch()"""

    def test_basic_batch_parsing(self):
        """Test basic batch JSON parsing."""
        json_str = '''[
            {"name": "Alice", "email": "alice@example.com", "age": 25},
            {"name": "Bob", "email": "bob@example.com", "age": 30}
        ]'''
        users = UserStruct.from_json_batch(json_str)

        assert len(users) == 2
        assert users[0].name == "Alice"
        assert users[0].age == 25
        assert users[1].name == "Bob"
        assert users[1].age == 30

    def test_empty_array(self):
        """Test empty JSON array."""
        users = UserStruct.from_json_batch('[]')
        assert users == []

    def test_single_item_array(self):
        """Test array with single item."""
        json_str = '[{"name": "Solo", "email": "solo@example.com", "age": 40}]'
        users = UserStruct.from_json_batch(json_str)

        assert len(users) == 1
        assert users[0].name == "Solo"

    def test_bytes_input(self):
        """Test batch parsing from bytes."""
        json_bytes = b'[{"name": "Test", "email": "test@example.com", "age": 20}]'
        users = UserStruct.from_json_batch(json_bytes)

        assert len(users) == 1
        assert users[0].name == "Test"

    def test_large_batch(self):
        """Test large batch parsing."""
        import json
        data = [{"name": f"User{i}", "email": f"user{i}@example.com", "age": 20 + (i % 100)}
                for i in range(1000)]
        json_str = json.dumps(data)

        users = UserStruct.from_json_batch(json_str)

        assert len(users) == 1000
        assert users[0].name == "User0"
        assert users[999].name == "User999"


class TestFromJsonBatchErrors:
    """Tests for error handling in from_json_batch()"""

    def test_invalid_json(self):
        """Test invalid JSON raises ValueError."""
        with pytest.raises(ValueError):
            UserStruct.from_json_batch('not valid json')

    def test_json_object_instead_of_array(self):
        """Test that JSON object raises error when array expected."""
        with pytest.raises(ValueError):
            UserStruct.from_json_batch('{"name": "John"}')

    def test_validation_error_in_batch(self):
        """Test that validation error in one item fails the whole batch."""
        json_str = '''[
            {"name": "Valid", "email": "valid@example.com", "age": 25},
            {"name": "", "email": "invalid@example.com", "age": 30}
        ]'''

        with pytest.raises(ValueError):
            UserStruct.from_json_batch(json_str)
