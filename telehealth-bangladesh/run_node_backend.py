import subprocess
import os
import sys

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    node_dir = os.path.join(base_dir, "node-backend")

    print("--- SwasthoNirapod: Starting Node.js Authentication Service at http://localhost:5000 ---")
    try:
        # Check if node_modules exists, otherwise install dependencies
        node_modules_path = os.path.join(node_dir, "node_modules")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        
        if not os.path.exists(node_modules_path):
            print("[INFO] node_modules not found. Running 'npm install' in node-backend...")
            subprocess.run([npm_cmd, "install"], cwd=node_dir, check=True)
            print("[SUCCESS] Node backend dependencies installed.")
        
        # Start the Node.js server
        subprocess.run([npm_cmd, "start"], cwd=node_dir)
    except KeyboardInterrupt:
        print("\nNode backend server stopped.")
    except Exception as e:
        print(f"[ERROR] Failed to execute Node.js authentication service: {e}")

if __name__ == "__main__":
    main()
