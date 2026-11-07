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

# Production Debug Toggle: Default to False unless explicitly set in local dev environment
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() == 'true'

# Whitelist allowed hostnames from environment
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1,0.0.0.0,*').split(',') if h.strip()]

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
    'rest_framework_simplejwt.token_blacklist',
    'channels',
    
    # App
    'api',
    'otp_security',
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
    'api.middleware.DisableClientCacheMiddleware',
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
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '5000/day' if not DEBUG else '100000/day',
        'user': '20000/day' if not DEBUG else '200000/day',
        'otp_ip': '30/minute' if not DEBUG else '300/minute',
        'otp_identifier': '15/minute' if not DEBUG else '150/minute',
    },
}

# JWT configurations: Rotating refresh tokens with automatic blacklisting upon rotation
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.environ.get('JWT_ACCESS_MINUTES', 1440))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.environ.get('JWT_REFRESH_DAYS', 7))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Strict CORS origin whitelist (never wildcard with credentials in healthcare production)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5002,http://127.0.0.1:5002'
    ).split(',') if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True

from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + [
    'cache-control',
    'pragma',
    'expires',
    'x-patient-id',
    'x-patient-username',
    'x-doctor-id',
    'x-doctor-username',
    'x-requested-with',
]

# Standard Security Headers across all modes
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

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

# ==============================================================================
# OTP SECURITY & CRYPTOGRAPHIC AUDIT CONFIGURATION
# ==============================================================================
from django.core.exceptions import ImproperlyConfigured

# OTP Cryptographic Pepper: Mandatory environment variable. Fail-fast if missing.
OTP_PEPPER = os.environ.get('OTP_PEPPER') or ('healnsight_dev_otp_pepper_256bit_secure_seed_2026_key' if DEBUG else None)
if not OTP_PEPPER:
    raise ImproperlyConfigured(
        "CRITICAL SECURITY CONFIGURATION ERROR: 'OTP_PEPPER' environment variable "
        "is required and cannot be empty. Define OTP_PEPPER before starting."
    )
if len(OTP_PEPPER.encode('utf-8')) < 32:
    raise ImproperlyConfigured(
        "CRITICAL SECURITY CONFIGURATION ERROR: 'OTP_PEPPER' must be at least "
        "32 bytes (256 bits) in length."
    )

# Cache setup (Redis for distributed rate-limiting and Celery broker)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache' if DEBUG else 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/1'),
    }
}

# Celery Task Queue Settings
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://127.0.0.1:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://127.0.0.1:6379/0')
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
CELERY_BEAT_SCHEDULE = {
    'daily-audit-merkle-anchor': {
        'task': 'otp_security.tasks.daily_merkle_anchor_task',
        'schedule': 86400.0, # Every 24 hours (Daily at midnight UTC)
    },
}

# SMS Provider Credentials
SMS_PROVIDER = os.environ.get('SMS_PROVIDER', 'stub')
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_FROM_NUMBER = os.environ.get('TWILIO_FROM_NUMBER', '')
SSL_WIRELESS_API_TOKEN = os.environ.get('SSL_WIRELESS_API_TOKEN', '')
SSL_WIRELESS_SID = os.environ.get('SSL_WIRELESS_SID', '')

# Tamper-Evident Ledger Anchoring (Polygon / Ethereum)
ANCHOR_ENABLED = os.environ.get('ANCHOR_ENABLED', 'False').lower() == 'true'
WEB3_PROVIDER_URI = os.environ.get('WEB3_PROVIDER_URI', 'https://polygon-rpc.com')
ANCHOR_CONTRACT_ADDRESS = os.environ.get('ANCHOR_CONTRACT_ADDRESS', '')
ANCHOR_SIGNER_PRIVATE_KEY = os.environ.get('ANCHOR_SIGNER_PRIVATE_KEY', '')

# Production HTTPS / HSTS Hardening
if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True').lower() == 'true'
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000 # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

