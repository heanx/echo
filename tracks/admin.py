from django.contrib import admin

from .models import Track, TrackLike, TrackPlay


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ("title", "artist", "status", "cover_theme", "has_cover_image", "duration_ms", "plays", "likes", "created_at")
    list_filter = ("status", "cover_theme", "created_at")
    search_fields = ("title", "artist", "description")

    @admin.display(boolean=True, description="自定义封面")
    def has_cover_image(self, obj):
        return bool(obj.cover_image)


@admin.register(TrackLike)
class TrackLikeAdmin(admin.ModelAdmin):
    list_display = ("track", "user", "created_at")
    list_filter = ("created_at",)
    search_fields = ("track__title", "track__artist", "user__username", "user__profile__display_name")


@admin.register(TrackPlay)
class TrackPlayAdmin(admin.ModelAdmin):
    list_display = ("track", "user", "session_key", "play_count", "played_at")
    list_filter = ("played_at",)
    search_fields = ("track__title", "track__artist", "user__username", "session_key")
