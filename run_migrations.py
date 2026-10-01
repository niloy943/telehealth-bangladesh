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

    result = subprocess.run([sys.executable, target_script], cwd=sub_dir)
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
