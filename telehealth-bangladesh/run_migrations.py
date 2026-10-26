import subprocess
import os
import sys

def get_python_exe():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    if sys.platform == "win32":
        venv_python_win = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
        if os.path.exists(venv_python_win):
            return venv_python_win
    else:
        venv_python = os.path.join(base_dir, ".venv", "bin", "python")
        if os.path.exists(venv_python):
            return venv_python
    return sys.executable

def run_command(cmd, cwd=None):
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, text=True, capture_output=False)
    if result.returncode != 0:
        print(f"Command failed with exit code: {result.returncode}")
        return False
    return True

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")
    py_exe = get_python_exe()

    print("--- HealNSight: Initializing Database & Seed Data ---")
    
    # 1. Makemigrations
    if not run_command([py_exe, "manage.py", "makemigrations", "api"], cwd=backend_dir):
        print("Error: makemigrations failed.")
        sys.exit(1)

    # 2. Migrate
    if not run_command([py_exe, "manage.py", "migrate"], cwd=backend_dir):
        print("Error: migrate failed.")
        sys.exit(1)

    # 3. Seed
    if not run_command([py_exe, "manage.py", "seed_data"], cwd=backend_dir):
        print("Error: seed_data failed.")
        sys.exit(1)

    print("\n[SUCCESS] HealNsightdatabase initialized and seeded successfully!")

if __name__ == "__main__":
    main()
