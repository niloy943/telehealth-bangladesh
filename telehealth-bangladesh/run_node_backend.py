import subprocess
import os
import sys

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    node_dir = os.path.join(base_dir, "node-backend")

    print("--- HealNSight: Starting Node.js Authentication Service at http://localhost:5000 ---")
    try:
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
        
        # Start the Node.js server directly
        server_path = os.path.join(node_dir, "src", "server.js")
        subprocess.run([node_exe, server_path], cwd=node_dir)
    except KeyboardInterrupt:
        print("\nNode backend server stopped.")
    except Exception as e:
        print(f"[WARNING] Node.js authentication service skipped ({e}).")
        print("[INFO] Django Backend, FastAPI Worker, and Frontend Web Application will continue running.")
        try:
            import time
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            print("\nNode backend standby process stopped.")

if __name__ == "__main__":
    main()
