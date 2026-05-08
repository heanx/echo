from django.contrib import admin

from .models import TrackLyricLine, TrackLyrics


class TrackLyricLineInline(admin.TabularInline):
    model = TrackLyricLine
    extra = 0


@admin.register(TrackLyrics)
class TrackLyricsAdmin(admin.ModelAdmin):
    list_display = ("track", "language", "kind", "is_primary", "created_at")
    list_filter = ("language", "kind", "is_primary", "created_at")
    search_fields = ("track__title", "raw_text")
    raw_id_fields = ("track",)
    inlines = [TrackLyricLineInline]


@admin.register(TrackLyricLine)
class TrackLyricLineAdmin(admin.ModelAdmin):
    list_display = ("lyrics", "time", "position", "text")
    search_fields = ("text", "translation", "lyrics__track__title")
    raw_id_fields = ("lyrics",)
