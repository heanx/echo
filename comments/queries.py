from tracks.models import Track

from .models import TrackComment


def resolve_comment_track(request):
    track_id = request.GET.get("track")
    if track_id:
        track = Track.objects.filter(pk=track_id, status=Track.STATUS_PUBLISHED).first()
        if track:
            return track

    track = (
        Track.objects.filter(status=Track.STATUS_PUBLISHED, comments__status=TrackComment.STATUS_PUBLISHED)
        .distinct()
        .order_by("-comments__created_at")
        .first()
    )
    if track:
        return track

    return Track.objects.filter(status=Track.STATUS_PUBLISHED).order_by("-updated_at").first()


def build_comment_queryset(track, sort="hot", comment_filter=""):
    if not track:
        return TrackComment.objects.none()

    effective_sort = "questions" if comment_filter == "questions" else sort
    return (
        TrackComment.objects.for_track(track)
        .visible()
        .top_level()
        .select_related("track", "user", "parent", "parent__user")
        .sorted(effective_sort)
    )


def get_comment_page_context(request):
    track = resolve_comment_track(request)
    sort = request.GET.get("sort", "hot")
    comment_filter = request.GET.get("filter", "")
    comments = list(build_comment_queryset(track, sort=sort, comment_filter=comment_filter))

    return {
        "track": track,
        "comments": comments,
        "sort": sort,
        "filter": comment_filter,
        "comment_count": len(comments),
    }
