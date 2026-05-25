from django.urls import path

from . import views


app_name = "comments"

urlpatterns = [
    path("<int:track_id>/create/", views.create_comment, name="create"),
    path("<int:comment_id>/like/", views.toggle_comment_like, name="toggle_like"),
    path("<int:comment_id>/delete/", views.delete_comment, name="delete"),
]
