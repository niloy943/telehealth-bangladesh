import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env or root .env if present
load_dotenv(BASE_DIR / '.env')
load_dotenv(BASE_DIR.parent / '.env')

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('TELEHEALTH_SECRET_KEY', 'django-insecure-vital-bd-secure-key-2026-xyz')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['*']

# Application definition
INSTALLED_APPS = [
    'daphne', # Channels ASGI server must be loaded before admin/staticfiles
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # 3rd Party Packages
    'corsheaders',
    'rest_framework',
    'channels',
    
    # App
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # CORS middleware must be loaded first
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'telehealth_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'telehealth_project.wsgi.application'
ASGI_APPLICATION = 'telehealth_project.asgi.application'

# Database Setup: Full PostgreSQL support with intelligent fallback to local SQLite
DATABASE_URL = os.environ.get('DATABASE_URL')
DB_ENGINE = os.environ.get('DB_ENGINE', '').lower()
DB_HOST = os.environ.get('DB_HOST') or os.environ.get('POSTGRES_HOST')

if DATABASE_URL:
    import urllib.parse
    url = urllib.parse.urlparse(DATABASE_URL)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': url.path[1:] if url.path else 'telehealth_bangladesh',
            'USER': url.username or 'postgres',
            'PASSWORD': url.password or 'postgres',
            'HOST': url.hostname or 'localhost',
            'PORT': str(url.port or '5432'),
            'CONN_MAX_AGE': int(os.environ.get('DB_CONN_MAX_AGE', 600)),
        }
    }
elif DB_HOST or 'postgres' in DB_ENGINE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME') or os.environ.get('POSTGRES_DB', 'telehealth_bangladesh'),
            'USER': os.environ.get('DB_USER') or os.environ.get('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.environ.get('DB_PASSWORD') or os.environ.get('POSTGRES_PASSWORD', 'postgres'),
            'HOST': DB_HOST or 'localhost',
            'PORT': str(os.environ.get('DB_PORT') or os.environ.get('POSTGRES_PORT', '5432')),
            'CONN_MAX_AGE': int(os.environ.get('DB_CONN_MAX_AGE', 600)),
        }
    }
else:
    sqlite_path = os.environ.get('DB_SQLITE_PATH')
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': sqlite_path if sqlite_path else BASE_DIR / 'db.sqlite3',
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Custom User Model
AUTH_USER_MODEL = 'api.User'

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Dhaka' # Bangladesh Standard Time
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework configurations
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# JWT configurations
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1), # Extended for demo simplicity
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS headers permissions
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Channel Layers
# Use InMemoryChannelLayer to run locally without Redis server dependency
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    },
}

# Email Backend Configuration for local development password resets
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = 'noreply@HealNSight.com'

# Token expiry for password reset in seconds (15 minutes = 900 seconds)
PASSWORD_RESET_TIMEOUT = 900
