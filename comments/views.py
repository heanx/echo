from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import F
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from tracks.models import Track

from .models import TrackComment, TrackCommentReaction


@login_required
@require_POST
def create_comment(request, track_id):
    track = get_object_or_404(Track, pk=track_id, status=Track.STATUS_PUBLISHED)
    body = request.POST.get("body", "").strip()
    if not body:
        return redirect(f"/comments/?track={track.pk}")

    parent = None
    parent_id = request.POST.get("parent")
    if parent_id:
        parent = get_object_or_404(TrackComment, pk=parent_id, track=track)

    timestamp_ms = request.POST.get("timestamp_ms") or None
    if timestamp_ms is not None:
        try:
            timestamp_ms = int(timestamp_ms)
        except ValueError:
            timestamp_ms = None

    with transaction.atomic():
        comment = TrackComment.objects.create(
            track=track,
            user=request.user,
            parent=parent,
            reply_to_user_name=request.POST.get("reply_to_user_name", "").strip(),
            author_name=request.user.profile.name,
            body=body,
            timestamp_ms=timestamp_ms,
            is_question="?" in body or "？" in body,
        )
        if comment.parent_id:
            TrackComment.objects.filter(pk=comment.parent_id).update(reply_count=F("reply_count") + 1)

    if request.headers.get("HX-Request"):
        return render(
            request,
            "comments/comment_item.html",
            {"track": track, "comment": comment, "liked_comment_ids": set(), "request": request},
        )
    return redirect(f"/comments/?track={track.pk}")


@login_required
@require_POST
def toggle_comment_like(request, comment_id):
    comment = get_object_or_404(TrackComment.objects.select_related("track"), pk=comment_id, status=TrackComment.STATUS_PUBLISHED)
    reaction, created = TrackCommentReaction.objects.get_or_create(comment=comment, user=request.user, reaction="like")
    if created:
        TrackComment.objects.filter(pk=comment.pk).update(like_count=F("like_count") + 1)
        liked = True
    else:
        reaction.delete()
        TrackComment.objects.filter(pk=comment.pk, like_count__gt=0).update(like_count=F("like_count") - 1)
        liked = False
    comment.refresh_from_db(fields=["like_count"])
    return JsonResponse({"ok": True, "liked": liked, "like_count": comment.like_count, "comment_id": comment.pk})
