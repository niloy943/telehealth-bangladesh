import subprocess
import os
import sys

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")

    print("--- HealNSight: Starting Django ASGI/REST Server at http://127.0.0.1:8000 ---")
    try:
        subprocess.run(
            [sys.executable, "-u", "manage.py", "runserver", "127.0.0.1:8000", "--noreload"],
            cwd=backend_dir
        )
    except KeyboardInterrupt:
        print("\nBackend server stopped.")

if __name__ == "__main__":
    main()
