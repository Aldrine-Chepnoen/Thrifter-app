import requests
import sys
import os

BASE_URL = "http://127.0.0.1:8000"

def log(msg):
    print(msg)
    with open("backend_status.txt", "a") as f:
        f.write(msg + "\n")

def test_root():
    try:
        r = requests.get(f"{BASE_URL}/docs")
        log(f"Docs endpoint status: {r.status_code}")
        if r.status_code == 200:
            log("Backend is accessible!")
            return True
    except Exception as e:
        log(f"Failed to connect to backend: {e}")
        return False
    return False

def test_items():
    try:
        r = requests.get(f"{BASE_URL}/items")
        log(f"Items endpoint status: {r.status_code}")
        log(f"Items count: {len(r.json())}")
    except Exception as e:
        log(f"Failed to fetch items: {e}")

if __name__ == "__main__":
    if test_root():
        test_items()
    else:
        sys.exit(1)
