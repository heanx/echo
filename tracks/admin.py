# -*- coding: utf-8 -*-
from django.contrib import admin

from .models import Track


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ("title", "artist", "status", "cover_theme", "has_cover_image", "duration_ms", "plays", "likes", "created_at")
    list_filter = ("status", "cover_theme", "created_at")
    search_fields = ("title", "artist", "description")

    @admin.display(boolean=True, description="自定义封面")
    def has_cover_image(self, obj):
        return bool(obj.cover_image)
