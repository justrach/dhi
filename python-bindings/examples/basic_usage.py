"""
Example usage of dhi validation library
"""

from dhi import BoundedInt, BoundedString, Email, ValidationError, ValidationErrors


def main():
    print("🚀 dhi - High-Performance Data Validation\n")
    
    # Example 1: Simple validators
    print("Example 1: Simple Validators")
    print("-" * 40)
    
    Age = BoundedInt(18, 90)
    Name = BoundedString(1, 40)
    
    try:
        age = Age.validate(25)
        print(f"✅ Valid age: {age}")
        
        name = Name.validate("Alice")
        print(f"✅ Valid name: {name}")
        
        email = Email.validate("alice@example.com")
        print(f"✅ Valid email: {email}")
    except ValidationError as e:
        print(f"❌ Validation error: {e}")
    
    print()
    
    # Example 2: Invalid data
    print("Example 2: Invalid Data")
    print("-" * 40)
    
    try:
        invalid_age = Age.validate(15)
    except ValidationError as e:
        print(f"❌ {e}")
    
    try:
        invalid_name = Name.validate("")
    except ValidationError as e:
        print(f"❌ {e}")
    
    try:
        invalid_email = Email.validate("not-an-email")
    except ValidationError as e:
        print(f"❌ {e}")
    
    print()
    
    # Example 3: User validation
    print("Example 3: User Validation")
    print("-" * 40)
    
    class User:
        def __init__(self, name: str, email: str, age: int):
            self.name = Name.validate(name)
            self.email = Email.validate(email)
            self.age = Age.validate(age)
        
        def __repr__(self):
            return f"User(name={self.name!r}, email={self.email!r}, age={self.age})"
    
    try:
        user = User("Bob", "bob@example.com", 30)
        print(f"✅ Valid user: {user}")
    except ValidationError as e:
        print(f"❌ Validation error: {e}")
    
    try:
        invalid_user = User("", "invalid", 15)
    except ValidationError as e:
        print(f"❌ First error caught: {e}")
    
    print()
    
    # Example 4: Batch validation
    print("Example 4: Batch Validation")
    print("-" * 40)
    
    users_data = [
        ("Alice", "alice@example.com", 25),
        ("Bob", "bob@example.com", 30),
        ("Charlie", "charlie@invalid", 35),  # Invalid email
        ("Dave", "dave@example.com", 15),    # Invalid age
    ]
    
    for name, email, age in users_data:
        try:
            user = User(name, email, age)
            print(f"✅ {user}")
        except ValidationError as e:
            print(f"❌ {name}: {e}")
    
    print("\n🎉 Examples complete!")


if __name__ == "__main__":
    main()
