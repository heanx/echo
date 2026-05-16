from django.db.models import Prefetch

from tracks.models import Track

from .models import TrackComment, TrackCommentReaction


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

    replies_queryset = (
        TrackComment.objects.visible()
        .select_related("track", "user", "parent", "parent__user")
        .order_by("created_at")
    )
    effective_sort = "questions" if comment_filter == "questions" else sort
    return (
        TrackComment.objects.for_track(track)
        .visible()
        .top_level()
        .select_related("track", "user", "parent", "parent__user")
        .prefetch_related(Prefetch("child_comments", queryset=replies_queryset))
        .sorted(effective_sort)
    )


def _collect_comment_ids(comments):
    ids = []
    for comment in comments:
        ids.append(comment.pk)
        ids.extend(reply.pk for reply in comment.child_comments.all())
    return ids


def get_comment_page_context(request):
    track = resolve_comment_track(request)
    sort = request.GET.get("sort", "hot")
    comment_filter = request.GET.get("filter", "")
    comments = list(build_comment_queryset(track, sort=sort, comment_filter=comment_filter))
    liked_comment_ids = set()
    if request.user.is_authenticated and comments:
        liked_comment_ids = set(
            TrackCommentReaction.objects.filter(
                user=request.user,
                reaction="like",
                comment_id__in=_collect_comment_ids(comments),
            ).values_list("comment_id", flat=True)
        )

    return {
        "track": track,
        "comments": comments,
        "sort": sort,
        "filter": comment_filter,
        "comment_count": len(comments),
        "liked_comment_ids": liked_comment_ids,
    }
