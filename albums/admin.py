from django.contrib import admin

from .models import Album, AlbumTrack, Playlist, PlaylistTrack


class AlbumTrackInline(admin.TabularInline):
    model = AlbumTrack
    extra = 1


@admin.register(Album)
class AlbumAdmin(admin.ModelAdmin):
    list_display = ("title", "creator", "cover_theme", "has_cover_image", "created_at")
    list_filter = ("cover_theme", "created_at")
    search_fields = ("title", "creator", "description")
    inlines = [AlbumTrackInline]

    @admin.display(boolean=True, description="自定义封面")
    def has_cover_image(self, obj):
        return bool(obj.cover_image)


@admin.register(AlbumTrack)
class AlbumTrackAdmin(admin.ModelAdmin):
    list_display = ("album", "track", "position", "added_at")
    list_filter = ("added_at",)
    search_fields = ("album__title", "track__title", "track__artist")


class PlaylistTrackInline(admin.TabularInline):
    model = PlaylistTrack
    extra = 1


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "is_public", "updated_at", "created_at")
    list_filter = ("is_public", "created_at", "updated_at")
    search_fields = ("title", "description", "owner__username", "owner__profile__display_name")
    inlines = [PlaylistTrackInline]


@admin.register(PlaylistTrack)
class PlaylistTrackAdmin(admin.ModelAdmin):
    list_display = ("playlist", "track", "position", "added_at")
    list_filter = ("added_at",)
    search_fields = ("playlist__title", "track__title", "track__artist")
