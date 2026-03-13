# This script checks if the backend of the Thrifter application is up and running by sending HTTP requests to the specified URL. It writes the status of the check to a file called "server_status_log.txt". The script attempts to connect to the backend for a maximum of 20 seconds, checking every second. If the backend responds with a status code of 200, it indicates that the backend is up, and the script exits with a success status. If the connection cannot be established within the timeout period, it writes a timeout message to the file and exits with an error status. This script can be used as part of a startup routine or health check to ensure that the backend is available before proceeding with other operations.
import requests
import time
import sys

url = "http://127.0.0.1:8000/docs"
with open("server_status_log.txt", "w") as f:
    f.write(f"Checking {url}...\n")
    for i in range(20):
        try:
            response = requests.get(url)
            if response.status_code == 200:
                f.write("\nBackend is up!\n")
                sys.exit(0)
        except requests.exceptions.ConnectionError:
            pass
        f.write(".")
        f.flush()
        time.sleep(1)
    f.write("\nBackend check timed out.\n")
sys.exit(1)
