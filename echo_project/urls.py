# -*- coding: utf-8 -*-
from django.contrib import admin
from django.conf import settings
from django.urls import include, path, re_path

from core.views import serve_media_range

handler404 = "core.views.error_404"
handler500 = "core.views.error_500"


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("core.urls")),
    path("tracks/", include("tracks.urls")),
    path("albums/", include("albums.urls")),
    path("comments/", include("comments.urls")),
    path("lyrics/", include("lyrics.urls")),
]

if settings.DEBUG:
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve_media_range, name="dev_media"),
    ]
