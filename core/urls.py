from django.urls import path

from . import views


urlpatterns = [
    path("", views.home, name="home"),
    path("lyrics/", views.lyrics, name="lyrics"),
    path("comments/", views.comments, name="comments"),
    path("search/", views.search_view, name="search"),
    path("login/", views.login_view, name="login"),
    path("register/", views.register_view, name="register"),
    path("logout/", views.logout_view, name="logout"),
    path("settings/profile/", views.profile_settings, name="profile_settings"),
    path("settings/security/", views.account_security, name="account_security"),
    path("users/<str:username>/", views.profile_view, name="profile"),
]
