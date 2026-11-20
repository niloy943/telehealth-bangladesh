import os
import sys
import subprocess

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    sub_dir = os.path.join(root_dir, "telehealth-bangladesh")
    target_script = os.path.join(sub_dir, "run_migrations.py")

    if not os.path.exists(target_script):
        print(f"Error: Could not find run_migrations.py in {sub_dir}")
        sys.exit(1)

    py_exe = sys.executable
    if sys.platform == "win32":
        venv_py = os.path.join(sub_dir, ".venv", "Scripts", "python.exe")
    else:
        venv_py = os.path.join(sub_dir, ".venv", "bin", "python")
    if os.path.exists(venv_py):
        py_exe = venv_py

    result = subprocess.run([py_exe, target_script], cwd=sub_dir)
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
