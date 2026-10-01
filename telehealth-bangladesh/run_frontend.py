import subprocess
import os
import sys

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_src_dir = os.path.join(base_dir, "frontend-src")
    frontend_dir = os.path.join(base_dir, "frontend")

    # Locate Node.js binary
    import shutil
    node_exe = os.environ.get("NODE_EXE", "node")
    if not shutil.which(node_exe):
        for candidate in [
            r"C:\Program Files\nodejs\node.exe",
            r"C:\Program Files (x86)\nodejs\node.exe",
            os.path.normpath(os.path.expanduser("~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"))
        ]:
            if os.path.exists(candidate):
                node_exe = candidate
                break

    vite_bin = os.path.join(frontend_src_dir, "node_modules", "vite", "bin", "vite.js")

    env = os.environ.copy()
    env.setdefault("VITE_API_BASE", "http://localhost:8000")
    env.setdefault("VITE_AUTH_API_BASE", os.environ.get("VITE_AUTH_API_BASE", "http://localhost:5001"))
    env.setdefault("VITE_FASTAPI_BASE", "http://localhost:6000")

    print("\n--- HealNSight: Starting High-Performance Vite Frontend Server on Port 3000 ---")
    print("Open http://localhost:3000 in your browser to view the platform.")

    if os.path.exists(frontend_src_dir) and os.path.exists(vite_bin):
        try:
            subprocess.run(
                [node_exe, vite_bin, "--port", "3000", "--host", "0.0.0.0"],
                cwd=frontend_src_dir,
                env=env
            )
        except KeyboardInterrupt:
            print("\nFrontend server stopped.")
    else:
        try:
            subprocess.run([sys.executable, "-m", "http.server", "3000"], cwd=frontend_dir)
        except KeyboardInterrupt:
            print("\nFrontend server stopped.")

if __name__ == "__main__":
    main()


