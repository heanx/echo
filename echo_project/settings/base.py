# -*- coding: utf-8 -*-
import os
from pathlib import Path
from urllib.parse import urlparse

from django.core.exceptions import ImproperlyConfigured


BASE_DIR = Path(__file__).resolve().parent.parent.parent


def env(name, default=None, required=False):
    value = os.environ.get(name, default)
    if required and (value is None or value == ""):
        raise ImproperlyConfigured(f"Missing required environment variable: {name}")
    return value


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=None):
    value = os.environ.get(name)
    if not value:
        return list(default or [])
    return [item.strip() for item in value.split(",") if item.strip()]


def database_config_from_url(url):
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()
    if scheme in {"postgres", "postgresql"}:
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed.path.lstrip("/") or env("POSTGRES_DB", required=True),
            "USER": parsed.username or env("POSTGRES_USER", required=True),
            "PASSWORD": parsed.password or env("POSTGRES_PASSWORD", required=True),
            "HOST": parsed.hostname or "localhost",
            "PORT": str(parsed.port or 5432),
            "CONN_MAX_AGE": 60,
        }
    if scheme == "sqlite":
        db_path = parsed.path
        if db_path in {"", "/:memory:"}:
            return {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / db_path.lstrip("/")}
    raise ImproperlyConfigured(f"Unsupported database URL scheme: {parsed.scheme}")


SECRET_KEY = env("ECHO_SECRET_KEY", "django-insecure-echo-dev-key")
DEBUG = env_bool("ECHO_DEBUG", False)
ALLOWED_HOSTS = env_list("ECHO_ALLOWED_HOSTS", ["localhost", "127.0.0.1", "testserver"])
CSRF_TRUSTED_ORIGINS = env_list("ECHO_CSRF_TRUSTED_ORIGINS", [])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "core",
    "tracks",
    "albums",
    "comments",
    "lyrics",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "echo_project.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "core.context_processors.user_status",
            ],
        },
    },
]

WSGI_APPLICATION = "echo_project.wsgi.application"
ASGI_APPLICATION = "echo_project.asgi.application"

database_url = env("ECHO_DATABASE_URL")
DATABASES = {
    "default": database_config_from_url(database_url)
    if database_url
    else {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}
}

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = True

# 显式声明文件编码，防止工具误判
FILE_CHARSET = "utf-8"
DEFAULT_CHARSET = "utf-8"

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "home"
LOGOUT_REDIRECT_URL = "home"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
