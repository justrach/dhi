from setuptools import setup, Extension, find_packages
from pathlib import Path
import os
import sys
import shutil

# Read README
readme_file = Path(__file__).parent / "README.md"
# Explicit UTF-8: the README contains non-ASCII and Windows' default codec is cp1252
long_description = readme_file.read_text(encoding="utf-8") if readme_file.exists() else ""

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
        
        # Create extension.
        # - macOS: rpath to @loader_path so the bundled libdhi.dylib is found next to the .so
        # - Linux: runtime_library_dirs (rpath) for the bundled libdhi.so
        # - Windows: MSVC has no rpath concept (and rejects runtime_library_dirs);
        #   the extension links against the Zig-generated dhi.lib import library and
        #   dhi.dll is loaded from the package directory next to the .pyd at import time.
        if sys.platform == 'win32':
            runtime_dirs = []
            link_args = []
        elif sys.platform == 'darwin':
            runtime_dirs = []
            link_args = ['-Wl,-rpath,@loader_path']
        else:
            runtime_dirs = [lib_dir]
            link_args = []

        native_ext = Extension(
            'dhi._dhi_native',
            sources=['dhi/_native.c'],
            include_dirs=[],
            library_dirs=[lib_dir],
            libraries=[lib_name],
            runtime_library_dirs=runtime_dirs,
            extra_link_args=link_args,
        )
        ext_modules = [native_ext]
        # ASCII only: Windows build consoles use cp1252 and cannot print emoji
        print("[dhi] Building with native Zig extension")
    else:
        print("[dhi] WARNING: Zig library not found - installing pure Python version")
        print(f"   Searched in: {[str(loc) for loc in lib_locations]}")

except Exception as e:
    print(f"[dhi] WARNING: Error setting up native extension: {e}")
    print("   Installing pure Python version")

setup(
    ext_modules=ext_modules,
)
