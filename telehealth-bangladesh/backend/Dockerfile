FROM python:3.10-slim

WORKDIR /app

# Install system dependencies needed for python packages (like cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libssl-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . .

# Expose Django port
EXPOSE 8000

# Run migrations, seed database, and run server on 0.0.0.0:8000
CMD ["sh", "-c", "python manage.py makemigrations api && python manage.py migrate && python manage.py seed_data && python -u manage.py runserver 0.0.0.0:8000 --noreload"]
