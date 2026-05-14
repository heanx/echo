from .base import *  # noqa: F401,F403


DEBUG = True
SECRET_KEY = env("ECHO_SECRET_KEY", "django-insecure-echo-dev-key")
ALLOWED_HOSTS = env_list("ECHO_ALLOWED_HOSTS", ["localhost", "127.0.0.1", "testserver"])
