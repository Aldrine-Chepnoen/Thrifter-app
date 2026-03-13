# This script checks if the frontend of the Thrifter application is up and running by sending HTTP requests to the specified URL. It writes the status of the check to a file called "frontend_status.txt". The script attempts to connect to the frontend for a maximum of 20 seconds, checking every second. If the frontend responds with a status code of 200, it indicates that the frontend is up, and the script exits with a success status. If the connection cannot be established within the timeout period, it writes a timeout message to the file and exits with an error status. This script can be used as part of a startup routine or health check to ensure that the frontend is available before proceeding with other operations.
import requests
import time
import sys

url = "http://127.0.0.1:5173"
with open("frontend_status.txt", "w") as f:
    f.write(f"Checking {url}...\n")
    for i in range(20):
        try:
            response = requests.get(url)
            if response.status_code == 200:
                f.write("\nFrontend is up!\n")
                sys.exit(0)
        except requests.exceptions.ConnectionError:
            pass
        f.write(".")
        f.flush()
        time.sleep(1)
    f.write("\nFrontend check timed out.\n")
sys.exit(1)
