# This script is designed to run the frontend development server for the Thrifter application and log its output for debugging purposes. It changes the working directory to the frontend folder, starts the npm development server, and logs the process output to a file called "npm_output.log". Additionally, it writes a global log of the script's execution to "frontend_debug_global.log", including any exceptions that may occur. The script also checks if the process is still running after a few seconds and terminates it if necessary. This can help identify issues with starting the frontend server and provide insights into any errors that may arise during the startup process.
import subprocess
import os
import time
import sys

log_path = r"c:\Users\A.K COMPUTERS\Documents\trae_projects\Thrifter\frontend_debug_global.log"

with open(log_path, "w") as global_log:
    global_log.write("Script started\n")
    try:
        # Change to frontend directory
        target_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
        os.chdir(target_dir)
        global_log.write(f"Changed directory to {os.getcwd()}\n")

        global_log.write("Starting npm run dev...\n")
        
        # Open a separate log file for the subprocess
        with open("npm_output.log", "w") as npm_log:
            # Use shell=True to find npm in path
            # explicit path to npm might be safer if not in path
            # But let's try just "npm" first
            process = subprocess.Popen(["npm", "run", "dev"], stdout=npm_log, stderr=npm_log, shell=True)
            global_log.write(f"Process started with PID {process.pid}\n")
            
            # Wait a few seconds to see if it crashes immediately
            time.sleep(5)
            
            if process.poll() is not None:
                global_log.write(f"Process exited with code {process.returncode}\n")
            else:
                global_log.write("Process is still running after 5s.\n")
                time.sleep(5)
                process.terminate()
                global_log.write("Terminated process.\n")
                
    except Exception as e:
        global_log.write(f"Exception: {e}\n")
