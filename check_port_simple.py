# This script checks if a specific port (5173) on the localhost is open or closed. It attempts to create a socket connection to the port and writes the result to a log file called "port_status.txt". If the connection is successful, it logs "OPEN"; if it fails, it logs "CLOSED" along with the error code. If any exceptions occur during the process, it logs the error message. This script can be used to monitor the status of a service running on that port, such as a frontend development server.
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
