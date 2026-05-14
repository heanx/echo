from django.urls import include, path


def boom(_request):
    raise RuntimeError("boom")


handler500 = "core.views.error_500"

urlpatterns = [
    path("", include("core.urls")),
    path("tracks/", include("tracks.urls")),
    path("albums/", include("albums.urls")),
    path("comments/", include("comments.urls")),
    path("lyrics/", include("lyrics.urls")),
    path("boom/", boom),
]
