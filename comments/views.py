from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import F
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from core.models import Notification
from tracks.models import Track

from .models import TrackComment, TrackCommentReaction


def _can_manage_comment(user, comment):
    if not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    if comment.user_id == user.id:
        return True
    return bool(comment.track.owner_id and comment.track.owner_id == user.id)


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
        parent = get_object_or_404(TrackComment, pk=parent_id, track=track, status=TrackComment.STATUS_PUBLISHED)

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
            if comment.parent.user_id and comment.parent.user_id != request.user.id:
                Notification.objects.create(
                    recipient=comment.parent.user,
                    actor=request.user,
                    kind=Notification.KIND_COMMENT_REPLY,
                    title=f"{request.user.profile.name} 回复了你的评论",
                    body=body[:160],
                    target_url=f"/comments/?track={track.pk}#comment-{comment.pk}",
                )

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
    comment = get_object_or_404(
        TrackComment.objects.select_related("track"),
        pk=comment_id,
        status=TrackComment.STATUS_PUBLISHED,
        track__status=Track.STATUS_PUBLISHED,
    )
    reaction, created = TrackCommentReaction.objects.get_or_create(comment=comment, user=request.user, reaction="like")
    if created:
        TrackComment.objects.filter(pk=comment.pk).update(like_count=F("like_count") + 1)
        if comment.user_id and comment.user_id != request.user.id:
            Notification.objects.create(
                recipient=comment.user,
                actor=request.user,
                kind=Notification.KIND_COMMENT_LIKE,
                title=f"{request.user.profile.name} 喜欢了你的评论",
                body=comment.body[:160],
                target_url=f"/comments/?track={comment.track_id}#comment-{comment.pk}",
            )
        liked = True
    else:
        reaction.delete()
        TrackComment.objects.filter(pk=comment.pk, like_count__gt=0).update(like_count=F("like_count") - 1)
        liked = False
    comment.refresh_from_db(fields=["like_count"])
    return JsonResponse({"ok": True, "liked": liked, "like_count": comment.like_count, "comment_id": comment.pk})


@login_required
@require_POST
def delete_comment(request, comment_id):
    comment = get_object_or_404(
        TrackComment.objects.select_related("track", "user"),
        pk=comment_id,
        status=TrackComment.STATUS_PUBLISHED,
        track__status=Track.STATUS_PUBLISHED,
    )
    if not _can_manage_comment(request.user, comment):
        return HttpResponse(status=403)

    with transaction.atomic():
        comment.status = TrackComment.STATUS_DELETED
        comment.body = "该评论已删除"
        comment.save(update_fields=["status", "body", "updated_at"])
        if comment.parent_id:
            TrackComment.objects.filter(pk=comment.parent_id, reply_count__gt=0).update(reply_count=F("reply_count") - 1)

    if request.headers.get("HX-Request"):
        return HttpResponse("")
    return redirect(f"/comments/?track={comment.track_id}")
