from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

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
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
