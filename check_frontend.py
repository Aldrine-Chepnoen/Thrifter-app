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
