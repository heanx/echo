# -*- coding: utf-8 -*-
from django.contrib import admin

from .models import TrackComment, TrackCommentReaction


@admin.register(TrackComment)
class TrackCommentAdmin(admin.ModelAdmin):
    list_display = ("track", "author", "status", "is_pinned", "is_question", "like_count", "reply_count", "created_at")
    list_filter = ("status", "is_pinned", "is_question", "created_at")
    search_fields = ("body", "author_name", "track__title")
    raw_id_fields = ("track", "user", "parent")


@admin.register(TrackCommentReaction)
class TrackCommentReactionAdmin(admin.ModelAdmin):
    list_display = ("comment", "user", "reaction", "created_at")
    list_filter = ("reaction", "created_at")
    raw_id_fields = ("comment", "user")
