def _get_display_name(user):
    if user.is_authenticated:
        return user.get_full_name() or user.get_username() or "Echo 用户"
    return "Echo 用户"


def _get_avatar_url(user):
    if not user.is_authenticated:
        return ""

    profile = getattr(user, "profile", None)
    avatar = getattr(profile, "avatar", None)
    if not avatar:
        return ""

    try:
        return avatar.url
    except ValueError:
        return ""


def user_status(request):
    from tracks.models import Track

    return {
        "display_name": _get_display_name(request.user),
        "user_avatar_url": _get_avatar_url(request.user),
        "unread_message_count": 0,
        "friend_request_count": 0,
        "shell_recent_tracks": Track.objects.filter(status=Track.STATUS_PUBLISHED).order_by("-updated_at")[:3],
    }
