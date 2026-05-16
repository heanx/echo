from django.urls import path

from . import views


app_name = "albums"

urlpatterns = [
    path("", views.album_list, name="list"),
    path("playlists/", views.playlist_list, name="playlists"),
    path("playlists/new/", views.playlist_create, name="playlist_create"),
    path("playlists/<int:pk>/", views.playlist_detail, name="playlist_detail"),
    path("playlists/<int:pk>/edit/", views.playlist_edit, name="playlist_edit"),
    path("playlists/<int:pk>/delete/", views.playlist_delete, name="playlist_delete"),
    path("playlists/<int:pk>/tracks/add/", views.playlist_add_track, name="playlist_add_track"),
    path("playlists/<int:pk>/tracks/<int:item_id>/remove/", views.playlist_remove_track, name="playlist_remove_track"),
    path("playlists/<int:pk>/tracks/<int:item_id>/reorder/", views.playlist_reorder_track, name="playlist_reorder_track"),
]
