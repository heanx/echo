from django.urls import path

from albums import views as album_views

from . import views


urlpatterns = [
    path("", views.home, name="home"),
    path("stream/<path:path>", views.serve_audio, name="serve_audio"),
    path("lyrics/", views.lyrics, name="lyrics"),
    path("comments/", views.comments, name="comments"),
    path("search/", views.search_view, name="search"),
    path("search/suggest/", views.search_suggest_view, name="search_suggest"),
    path("login/", views.login_view, name="login"),
    path("register/", views.register_view, name="register"),
    path("logout/", views.logout_view, name="logout"),
    path("notifications/", views.notifications, name="notifications"),
    path("notifications/<int:pk>/read/", views.mark_notification_read, name="notification_read"),
    path("settings/profile/", views.profile_settings, name="profile_settings"),
    path("settings/security/", views.account_security, name="account_security"),
    path("users/<str:username>/playlist/", album_views.user_playlist_center, name="user_playlists"),
    path("users/<str:username>/playlist/create/", album_views.playlist_create, name="user_playlist_create"),
    path("users/<str:username>/playlist/<int:pk>/", album_views.playlist_detail, name="user_playlist_detail"),
    path("users/<str:username>/playlist/<int:pk>/edit/", album_views.playlist_edit, name="user_playlist_edit"),
    path("users/<str:username>/playlist/<int:pk>/delete/", album_views.playlist_delete, name="user_playlist_delete"),
    path("users/<str:username>/playlist/<int:pk>/favorite/", album_views.playlist_toggle_favorite, name="user_playlist_favorite"),
    path("users/<str:username>/playlist/<int:pk>/tracks/add/", album_views.playlist_add_track, name="user_playlist_add_track"),
    path("users/<str:username>/playlist/<int:pk>/tracks/bulk/", album_views.playlist_bulk_manage, name="user_playlist_bulk_manage"),
    path("users/<str:username>/playlist/<int:pk>/tracks/<int:item_id>/remove/", album_views.playlist_remove_track, name="user_playlist_remove_track"),
    path("users/<str:username>/playlist/<int:pk>/tracks/<int:item_id>/reorder/", album_views.playlist_reorder_track, name="user_playlist_reorder_track"),
    path("users/<str:username>/", views.profile_view, name="profile"),
]
