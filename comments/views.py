from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from tracks.models import Track

from .models import TrackComment


@require_POST
def create_comment(request, track_id):
    track = get_object_or_404(Track, pk=track_id)
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
            user=request.user if request.user.is_authenticated else None,
            parent=parent,
            reply_to_user_name=request.POST.get("reply_to_user_name", "").strip(),
            author_name=request.POST.get("author_name", "").strip() or "Echo 用户",
            body=body,
            timestamp_ms=timestamp_ms,
            is_question="?" in body or "？" in body,
        )
        if comment.parent_id:
            TrackComment.objects.filter(pk=comment.parent_id).update(reply_count=F("reply_count") + 1)

    if request.headers.get("HX-Request"):
        return render(request, "comments/comment_item.html", {"track": track, "comment": comment})
    return redirect(f"/comments/?track={track.pk}")
