from setuptools import setup, Extension, find_packages
from pathlib import Path
import os
import sys
import shutil

# Read README
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text() if readme_file.exists() else ""

# Try to find and use the Zig library
ext_modules = []

try:
    # Look for Zig library in multiple locations
    lib_locations = [
        Path(__file__).parent / ".." / "zig-out" / "lib",  # Local build
        Path(__file__).parent / "dhi",  # Bundled in package
    ]
    
    lib_name = 'dhi'
    lib_file = None
    lib_dir = None
    
    # Platform-specific library extension
    if sys.platform == 'darwin':
        lib_patterns = [f'lib{lib_name}.dylib']
    elif sys.platform == 'win32':
        lib_patterns = [f'{lib_name}.dll', f'lib{lib_name}.dll']
    else:
        lib_patterns = [f'lib{lib_name}.so']
    
    # Find the library
    for location in lib_locations:
        if location.exists():
            for pattern in lib_patterns:
                lib_path = location / pattern
                if lib_path.exists():
                    lib_file = str(lib_path)
                    lib_dir = str(location)
                    print(f"Found Zig library: {lib_file}")
                    break
            if lib_file:
                break
    
    if lib_file and lib_dir:
        # Copy library to package directory for bundling
        package_lib_dir = Path(__file__).parent / "dhi"
        package_lib_dir.mkdir(exist_ok=True)
        
        for pattern in lib_patterns:
            src = Path(lib_dir) / pattern
            if src.exists():
                dst = package_lib_dir / pattern
                shutil.copy2(src, dst)
                print(f"Copied {src} -> {dst}")
        
        # Create extension
        native_ext = Extension(
            'dhi._dhi_native',
            sources=['dhi/_native.c'],
            include_dirs=[],
            library_dirs=[lib_dir],
            libraries=[lib_name],
            runtime_library_dirs=[lib_dir] if sys.platform != 'darwin' else [],
            extra_link_args=['-Wl,-rpath,@loader_path'] if sys.platform == 'darwin' else [],
        )
        ext_modules = [native_ext]
        print("✅ Building with native Zig extension")
    else:
        print("⚠️  Zig library not found - installing pure Python version")
        print(f"   Searched in: {[str(loc) for loc in lib_locations]}")

except Exception as e:
    print(f"⚠️  Error setting up native extension: {e}")
    print("   Installing pure Python version")

setup(
    ext_modules=ext_modules,
)
