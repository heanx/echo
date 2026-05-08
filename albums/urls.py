from django.urls import path

from . import views


app_name = "albums"

urlpatterns = [
    path("", views.album_list, name="list"),
]
