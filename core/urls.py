from django.urls import path

from . import views


urlpatterns = [
    path("", views.home, name="home"),
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
    path("users/<str:username>/", views.profile_view, name="profile"),
]
