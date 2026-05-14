from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403


DEBUG = False
SECRET_KEY = env("ECHO_SECRET_KEY", required=True)
ALLOWED_HOSTS = env_list("ECHO_ALLOWED_HOSTS", [])
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("ECHO_ALLOWED_HOSTS must contain at least one hostname in production.")

if not env("ECHO_DATABASE_URL"):
    raise ImproperlyConfigured("ECHO_DATABASE_URL is required for production settings.")

DATABASES = {"default": database_config_from_url(env("ECHO_DATABASE_URL", required=True))}

CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = int(env("ECHO_SECURE_HSTS_SECONDS", "3600"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("ECHO_SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
SECURE_HSTS_PRELOAD = env_bool("ECHO_SECURE_HSTS_PRELOAD", False)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("ECHO_SECURE_SSL_REDIRECT", True)
