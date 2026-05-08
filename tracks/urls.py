from django.urls import path

from . import views


app_name = "tracks"

urlpatterns = [
    path("", views.track_list, name="list"),
    path("latest/", views.latest_tracks, name="latest"),
    path("upload/", views.upload_track, name="upload"),
    path("<int:pk>/", views.track_detail, name="detail"),
]
