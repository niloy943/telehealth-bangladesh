FROM python:3.10-slim

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI files
COPY . .

# Expose FastAPI port
EXPOSE 6000

# Start FastAPI using uvicorn on 0.0.0.0:6000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "6000"]
