import subprocess
import os
import sys

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    fastapi_dir = os.path.join(base_dir, "fastapi-backend")

    print("--- SwasthoNirapod: Starting FastAPI Upstream Worker at http://127.0.0.1:6000 ---")
    try:
        # Check if fastapi and uvicorn are installed, otherwise install them
        try:
            import fastapi
            import uvicorn
            import pydantic
        except ImportError:
            print("[INFO] fastapi, uvicorn, or pydantic not found in environment. Installing...")
            subprocess.run([sys.executable, "-m", "pip", "install", "fastapi", "uvicorn", "pydantic"], check=True)
            print("[SUCCESS] FastAPI dependencies installed.")

        # Start the FastAPI server
        subprocess.run(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "6000"],
            cwd=fastapi_dir
        )
    except KeyboardInterrupt:
        print("\nFastAPI server stopped.")
    except Exception as e:
        print(f"[ERROR] Failed to execute FastAPI server: {e}")

if __name__ == "__main__":
    main()
