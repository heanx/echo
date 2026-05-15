# -*- coding: utf-8 -*-
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
    avatar = getattr(profile, "avatar", None)
    if not avatar:
        return ""

    try:
        return avatar.url
    except ValueError:
        return ""


def user_status(request):
    from tracks.models import Track

    queue_tracks = list(Track.objects.filter(status=Track.STATUS_PUBLISHED).order_by("-updated_at")[:10])

    return {
        "display_name": _get_display_name(request.user),
        "user_avatar_url": _get_avatar_url(request.user),
        "unread_message_count": 0,
        "friend_request_count": 0,
        "shell_recent_tracks": queue_tracks[:3],
        "shell_queue_tracks": queue_tracks,
    }
