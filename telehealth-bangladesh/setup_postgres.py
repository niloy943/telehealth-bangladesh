#!/usr/bin/env python
"""
Telehealth Bangladesh - PostgreSQL Database Provisioner & Initializer
---------------------------------------------------------------------
Automates testing PostgreSQL connectivity, provisioning the database,
applying schema migrations, and populating initial seed records.
"""

import os
import sys
import argparse
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

def get_postgres_config():
    db_url = os.environ.get('DATABASE_URL')
    if db_url:
        parsed = urlparse(db_url)
        return {
            'dbname': parsed.path[1:] if parsed.path else 'telehealth_bangladesh',
            'user': parsed.username or 'postgres',
            'password': parsed.password or 'postgres',
            'host': parsed.hostname or 'localhost',
            'port': parsed.port or 5432,
        }
    return {
        'dbname': os.environ.get('DB_NAME') or os.environ.get('POSTGRES_DB', 'telehealth_bangladesh'),
        'user': os.environ.get('DB_USER') or os.environ.get('POSTGRES_USER', 'postgres'),
        'password': os.environ.get('DB_PASSWORD') or os.environ.get('POSTGRES_PASSWORD', 'postgres'),
        'host': os.environ.get('DB_HOST') or os.environ.get('POSTGRES_HOST', 'localhost'),
        'port': int(os.environ.get('DB_PORT') or os.environ.get('POSTGRES_PORT', 5432)),
    }

def create_postgres_database(config):
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

    target_db = config['dbname']
    print(f"[*] Checking PostgreSQL connection at {config['host']}:{config['port']} (user: {config['user']})...")

    try:
        conn = psycopg2.connect(
            dbname='postgres',
            user=config['user'],
            password=config['password'],
            host=config['host'],
            port=config['port']
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        # Check if database exists
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (target_db,))
        exists = cursor.fetchone()

        if not exists:
            print(f"[+] Creating PostgreSQL database: '{target_db}'...")
            cursor.execute(f'CREATE DATABASE "{target_db}" WITH ENCODING "UTF8";')
            print(f"[✓] Database '{target_db}' successfully created.")
        else:
            print(f"[✓] Database '{target_db}' already exists.")

        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"[!] PostgreSQL connection warning: {e}")
        return False

def run_django_setup(config, seed=True):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    os.environ['DB_HOST'] = config['host']
    os.environ['DB_PORT'] = str(config['port'])
    os.environ['DB_NAME'] = config['dbname']
    os.environ['DB_USER'] = config['user']
    os.environ['DB_PASSWORD'] = config['password']
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'telehealth_project.settings')

    import django
    django.setup()

    from django.core.management import call_command
    print("\n[*] Applying Django schema migrations on PostgreSQL...")
    call_command('migrate', interactive=False)
    print("[✓] All database migrations applied.")

    if seed:
        print("\n[*] Seeding initial data (Admins, Doctors, Patients, Pharmacy Inventory)...")
        call_command('seed_data', reset=True)
        print("[✓] Database seeding complete.")

def main():
    parser = argparse.ArgumentParser(description="Provision & Initialize PostgreSQL for Telehealth Bangladesh")
    parser.add_argument('--no-seed', action='store_true', help="Skip seeding initial mock data")
    args = parser.parse_args()

    print("=" * 70)
    print("      TELEHEALTH BANGLADESH - POSTGRESQL BACKEND INITIALIZER         ")
    print("=" * 70)

    config = get_postgres_config()
    print(f"Target Database : {config['dbname']}")
    print(f"Host / Port     : {config['host']}:{config['port']}")
    print(f"User            : {config['user']}")
    print("-" * 70)

    created = create_postgres_database(config)
    if not created:
        print("\n[!] Could not connect to external PostgreSQL server directly.")
        print("[i] If you are running locally without Postgres installed, Django will fallback to SQLite.")
        print("[i] To launch PostgreSQL with Docker, run:\n    docker-compose up -d postgres\n")
        return 1

    run_django_setup(config, seed=not args.no_seed)
    print("\n" + "=" * 70)
    print("   [✓] POSTGRESQL BACKEND PROVISIONING COMPLETED SUCCESSFULLY!        ")
    print("=" * 70)
    return 0

if __name__ == '__main__':
    sys.exit(main())
