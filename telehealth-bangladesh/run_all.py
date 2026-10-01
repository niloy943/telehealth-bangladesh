import subprocess
import os
import sys
import time

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

def run_script_sync(name):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.join(base_dir, name)
    py_exe = get_python_exe()
    print(f"\n>>> Running setup stage: {name}")
    res = subprocess.run([py_exe, script_path])
    return res.returncode == 0

def main():
    # 1. Run migrations and database seeding
    if not run_script_sync("run_migrations.py"):
        print("Database migrations and seeding failed. Aborting startup.")
        sys.exit(1)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    py_exe = get_python_exe()
    backend_script = os.path.join(base_dir, "run_backend.py")
    node_backend_script = os.path.join(base_dir, "run_node_backend.py")
    frontend_script = os.path.join(base_dir, "run_frontend.py")
    fastapi_script = os.path.join(base_dir, "run_fastapi.py")

    print("\n>>> Launching Django Backend, Node.js Auth, FastAPI Worker, & Frontend services...")

    # Spawn backend
    backend_proc = subprocess.Popen([py_exe, backend_script])
    
    # Spawn Node.js Auth
    node_backend_proc = subprocess.Popen([py_exe, node_backend_script])
    
    # Spawn FastAPI Upstream Worker
    fastapi_proc = subprocess.Popen([py_exe, fastapi_script])
    
    # Spawn frontend
    frontend_proc = subprocess.Popen([py_exe, frontend_script])

    print("\n=======================================================")
    print(" HealNSight Telemedicine Platform is running!")
    print(" Django Backend API: http://127.0.0.1:8000")
    print(" Node.js Auth API: http://localhost:5001")
    print(" FastAPI Upstream Worker: http://localhost:6000")
    print(" Frontend Web Application: http://localhost:3000")
    print(" Press Ctrl+C in this terminal to stop all servers.")
    print("=======================================================\n")

    try:
        while True:
            # Check if any process has terminated
            if backend_proc.poll() is not None:
                print("Django Backend server stopped unexpectedly.")
                break
            if node_backend_proc.poll() is not None:
                print("Node.js Auth server stopped unexpectedly.")
                break
            if fastapi_proc.poll() is not None:
                print("FastAPI server stopped unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("Frontend server stopped unexpectedly.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping all services...")
    finally:
        # Terminate processes
        backend_proc.terminate()
        node_backend_proc.terminate()
        fastapi_proc.terminate()
        frontend_proc.terminate()
        backend_proc.wait()
        node_backend_proc.wait()
        fastapi_proc.wait()
        frontend_proc.wait()
        print("All servers stopped successfully.")

if __name__ == "__main__":
    main()
