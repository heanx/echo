def _get_profile(user):
    if not user.is_authenticated:
        return None
    try:
        return user.profile
    except Exception:
        return None


def _get_display_name(user):
    if not user.is_authenticated:
        return "Echo 用户"
    profile = _get_profile(user)
    profile_name = profile.display_name if profile and profile.display_name else ""
    return profile_name or user.get_full_name() or user.get_username() or "Echo 用户"


def _get_avatar_url(user):
    profile = _get_profile(user)
    return profile.avatar_url if profile else ""


def _compact_count(value):
    return "999+" if value > 999 else str(value)


def user_status(request):
    from albums.models import Playlist, ensure_liked_playlist
    from tracks.models import Track, TrackLike, TrackPlay

    queue_tracks = list(Track.objects.filter(status=Track.STATUS_PUBLISHED).order_by("-updated_at")[:10])
    recent_tracks = []
    liked_track_count = 0
    unread_message_count = 0
    shell_my_playlists = []
    shell_favorite_playlists = []
    shell_liked_playlist = None
    if request.user.is_authenticated:
        shell_liked_playlist = ensure_liked_playlist(request.user)
        unread_message_count = request.user.notifications.filter(is_read=False).count()
        recent_tracks = [
            item.track
            for item in TrackPlay.objects.filter(user=request.user, track__status=Track.STATUS_PUBLISHED)
            .select_related("track")
            .order_by("-played_at")[:5]
        ]
        liked_track_count = TrackLike.objects.filter(user=request.user, track__status=Track.STATUS_PUBLISHED).count()
        shell_my_playlists = list(
            Playlist.objects.filter(
                creator=request.user,
                playlist_type=Playlist.TYPE_NORMAL,
                is_deleted=False,
            )
            .select_related("creator")
            .order_by("-updated_at")[:5]
        )
        shell_favorite_playlists = list(
            Playlist.objects.filter(
                favorites__user=request.user,
                visibility=Playlist.VISIBILITY_PUBLIC,
                is_deleted=False,
            )
            .select_related("creator")
            .distinct()
            .order_by("-favorites__created_at")[:5]
        )
    elif request.session.session_key:
        recent_tracks = [
            item.track
            for item in TrackPlay.objects.filter(session_key=request.session.session_key, track__status=Track.STATUS_PUBLISHED)
            .select_related("track")
            .order_by("-played_at")[:5]
        ]

    return {
        "display_name": _get_display_name(request.user),
        "user_avatar_url": _get_avatar_url(request.user),
        "unread_message_count": unread_message_count,
        "friend_request_count": 0,
        "shell_recent_tracks": recent_tracks,
        "shell_liked_track_count": liked_track_count,
        "shell_liked_track_count_label": _compact_count(liked_track_count),
        "shell_liked_playlist": shell_liked_playlist,
        "shell_my_playlists": shell_my_playlists,
        "shell_favorite_playlists": shell_favorite_playlists,
        "shell_queue_tracks": queue_tracks,
    }
