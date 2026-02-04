import socket
import sys
import os

log_file = r"c:\Users\A.K COMPUTERS\Documents\trae_projects\Thrifter\port_status.txt"

def check_port():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        result = s.connect_ex(('127.0.0.1', 5173))
        s.close()
        
        with open(log_file, "w") as f:
            if result == 0:
                f.write("OPEN")
                print("OPEN")
            else:
                f.write(f"CLOSED: {result}")
                print(f"CLOSED: {result}")
    except Exception as e:
        with open(log_file, "w") as f:
            f.write(f"ERROR: {e}")
            print(f"ERROR: {e}")

if __name__ == "__main__":
    check_port()
