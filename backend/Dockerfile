# This is the Dockerfile for the Thrifter backend application. It uses a Python 3.11 slim image as the base, sets the working directory to /app, and copies the requirements.txt file to install dependencies. The backend source code is then copied into the container, and an images directory is created for handling uploads. The FastAPI application is exposed on port 8000, and the container starts the backend using uvicorn when run. This Dockerfile allows for easy deployment of the backend application in a containerized environment, ensuring that all necessary dependencies are included and that the application can run consistently across different environments.
# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

# Create images directory for uploads
RUN mkdir -p /app/images

# Expose the port FastAPI will run on
EXPOSE 8000

# Start the backend with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
