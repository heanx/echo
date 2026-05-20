from django.urls import path

from . import views


app_name = "tracks"

urlpatterns = [
    path("", views.track_list, name="list"),
    path("latest/", views.latest_tracks, name="latest"),
    path("liked/", views.liked_tracks, name="liked"),
    path("upload/", views.upload_track, name="upload"),
    path("<int:pk>/play/", views.record_play, name="record_play"),
    path("<int:pk>/like/", views.toggle_track_like, name="toggle_like"),
    path("<int:pk>/like/status/", views.track_like_status, name="like_status"),
    path("<int:pk>/", views.track_detail, name="detail"),
]
