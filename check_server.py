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
