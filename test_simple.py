# This script is a simple test to verify that the Python environment is set up correctly and can write to a file. It creates a file called "simple_log.txt" and writes the message "Hello from python" into it. This can be used as a basic check to ensure that the Python interpreter is functioning and has permission to write to the filesystem in the current directory.
with open("simple_log.txt", "w") as f:
    f.write("Hello from python")
