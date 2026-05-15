# -*- coding: utf-8 -*-
from django.urls import path

from . import views


app_name = "lyrics"

urlpatterns = [
    path("upload/", views.upload_lyrics, name="upload"),
]
