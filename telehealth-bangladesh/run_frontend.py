import subprocess
import os
import sys

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_src_dir = os.path.join(base_dir, "frontend-src")
    frontend_dir = os.path.join(base_dir, "frontend")

    # Auto-compile Vite assets if src folder exists
    if os.path.exists(frontend_src_dir):
        print("--- HealNSight: Compiling React/Vite assets via npm run build ---")
        try:
            # On Windows, npm is usually npm.cmd
            npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
            subprocess.run([npm_cmd, "run", "build"], cwd=frontend_src_dir, check=True)
            print("[SUCCESS] Frontend assets built successfully!")
        except Exception as e:
            print(f"[WARNING] Automated build failed: {e}. Attempting to serve existing build.")

    print("\n--- HealNSight: Starting Frontend Server on Port 3000 ---")
    print("Open http://localhost:3000 in your browser to view the platform.")
    try:
        subprocess.run([sys.executable, "-m", "http.server", "3000"], cwd=frontend_dir)
    except KeyboardInterrupt:
        print("\nFrontend server stopped.")

if __name__ == "__main__":
    main()

