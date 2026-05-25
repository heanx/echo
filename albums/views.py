from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from django.db.models import F, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from .forms import PlaylistBulkManageForm, PlaylistForm, PlaylistTrackForm
from .models import Album, Playlist, PlaylistFavorite, PlaylistTrack, ensure_liked_playlist
from comments.models import TrackComment, TrackCommentReaction
from tracks.views import liked_track_ids_for


User = get_user_model()


def _playlist_detail_url(playlist):
    return "user_playlist_detail", {"username": playlist.creator.username, "pk": playlist.pk}


def _redirect_playlist_detail(playlist):
    name, kwargs = _playlist_detail_url(playlist)
    return redirect(name, **kwargs)


def album_list(request):
    albums = Album.objects.all()
    visible_filter = Q(visibility=Playlist.VISIBILITY_PUBLIC, is_deleted=False, playlist_type=Playlist.TYPE_NORMAL)
    playlists = Playlist.objects.filter(visible_filter).select_related("creator")[:12]
    return render(request, "albums/list.html", {"albums": albums, "playlists": playlists})


def user_playlist_center(request, username):
    profile_user = get_object_or_404(User, username=username)
    is_owner = request.user.is_authenticated and request.user == profile_user
    liked_playlist = ensure_liked_playlist(profile_user) if is_owner else None
    if is_owner:
        my_playlists = Playlist.objects.filter(
            creator=profile_user,
            playlist_type=Playlist.TYPE_NORMAL,
            is_deleted=False,
        ).select_related("creator")
        favorite_playlists = (
            Playlist.objects.filter(
                favorites__user=profile_user,
                visibility=Playlist.VISIBILITY_PUBLIC,
                is_deleted=False,
            )
            .select_related("creator")
            .distinct()
        )
    else:
        my_playlists = Playlist.objects.filter(
            creator=profile_user,
            playlist_type=Playlist.TYPE_NORMAL,
            visibility=Playlist.VISIBILITY_PUBLIC,
            is_deleted=False,
        ).select_related("creator")
        favorite_playlists = Playlist.objects.none()
    return render(
        request,
        "albums/user_playlist_center.html",
        {
            "profile_user": profile_user,
            "is_owner": is_owner,
            "liked_playlist": liked_playlist,
            "my_playlists": my_playlists,
            "favorite_playlists": favorite_playlists,
        },
    )


@login_required
def playlist_create(request, username=None):
    if username and username != request.user.username:
        return redirect("user_playlist_create", username=request.user.username)
    form = PlaylistForm(request.POST or None, request.FILES or None)
    if request.method == "POST" and form.is_valid():
        playlist = form.save(commit=False)
        playlist.creator = request.user
        playlist.playlist_type = Playlist.TYPE_NORMAL
        playlist.save()
        messages.success(request, "歌单已创建。")
        return _redirect_playlist_detail(playlist)
    return render(request, "albums/playlist_form.html", {"form": form, "page_title": "创建歌单"})


def playlist_detail(request, username, pk):
    track_items = PlaylistTrack.objects.select_related("track").order_by("position", "added_at")
    queryset = Playlist.objects.select_related("creator").prefetch_related(
        Prefetch("playlist_tracks", queryset=track_items),
        "favorites__user",
    )
    if request.user.is_authenticated:
        playlist = get_object_or_404(
            queryset.filter(Q(visibility=Playlist.VISIBILITY_PUBLIC) | Q(creator=request.user), is_deleted=False).distinct(),
            pk=pk,
        )
    else:
        playlist = get_object_or_404(queryset, pk=pk, visibility=Playlist.VISIBILITY_PUBLIC, is_deleted=False)
    if playlist.creator.username != username:
        return redirect("user_playlist_detail", username=playlist.creator.username, pk=playlist.pk)
    is_favorited = request.user.is_authenticated and PlaylistFavorite.objects.filter(user=request.user, playlist=playlist).exists()
    playlist_items = list(playlist.playlist_tracks.all())
    tracks = [item.track for item in playlist_items]
    track_ids = [track.pk for track in tracks]
    playlist_comments = list(
        TrackComment.objects.filter(track_id__in=track_ids)
        .visible()
        .top_level()
        .select_related("track", "user")
        .prefetch_related("child_comments")
        .order_by("-is_pinned", "-like_count", "-created_at")[:30]
    )
    liked_comment_ids = set()
    if request.user.is_authenticated and playlist_comments:
        comment_ids = [comment.pk for comment in playlist_comments]
        liked_comment_ids = set(
            TrackCommentReaction.objects.filter(
                user=request.user,
                reaction="like",
                comment_id__in=comment_ids,
            ).values_list("comment_id", flat=True)
        )
    playlist_favorites = list(playlist.favorites.select_related("user", "user__profile").order_by("-created_at")[:40])
    return render(
        request,
        "albums/playlist_detail.html",
        {
            "playlist": playlist,
            "playlist_items": playlist_items,
            "playlist_comments": playlist_comments,
            "playlist_favorites": playlist_favorites,
            "is_favorited": is_favorited,
            "liked_track_ids": liked_track_ids_for(request.user, tracks),
            "liked_comment_ids": liked_comment_ids,
        },
    )


@login_required
def playlist_edit(request, username, pk):
    playlist = get_object_or_404(Playlist, pk=pk, creator=request.user, creator__username=username, is_deleted=False)
    if playlist.is_liked_playlist:
        messages.error(request, "默认喜欢歌单不能编辑。")
        return _redirect_playlist_detail(playlist)
    form = PlaylistForm(request.POST or None, request.FILES or None, instance=playlist)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "歌单已更新。")
        return _redirect_playlist_detail(playlist)
    return render(request, "albums/playlist_form.html", {"form": form, "page_title": "编辑歌单", "playlist": playlist})


@login_required
@require_POST
def playlist_delete(request, username, pk):
    playlist = get_object_or_404(Playlist, pk=pk, creator=request.user, creator__username=username, is_deleted=False)
    if playlist.is_liked_playlist:
        messages.error(request, "默认喜欢歌单不能删除。")
        return _redirect_playlist_detail(playlist)
    playlist.is_deleted = True
    playlist.save(update_fields=["is_deleted", "updated_at"])
    messages.success(request, "歌单已删除。")
    return redirect("user_playlists", username=request.user.username)


@login_required
@require_POST
def playlist_add_track(request, username, pk):
    playlist = get_object_or_404(Playlist, pk=pk, creator=request.user, creator__username=username, is_deleted=False)
    form = PlaylistTrackForm(request.POST, playlist=playlist)
    if form.is_valid():
        playlist_track = form.save(commit=False)
        playlist_track.playlist = playlist
        playlist_track.added_by = request.user
        playlist_track.save()
        playlist.track_count = playlist.playlist_tracks.count()
        playlist.save(update_fields=["track_count", "updated_at"])
        messages.success(request, "歌曲已加入歌单。")
    else:
        messages.error(request, "歌曲没有添加成功，请确认没有重复添加。")
    return _redirect_playlist_detail(playlist)


@login_required
@require_POST
def playlist_remove_track(request, username, pk, item_id):
    playlist = get_object_or_404(Playlist, pk=pk, creator=request.user, creator__username=username, is_deleted=False)
    get_object_or_404(PlaylistTrack, pk=item_id, playlist=playlist).delete()
    playlist.track_count = playlist.playlist_tracks.count()
    playlist.save(update_fields=["track_count", "updated_at"])
    messages.success(request, "歌曲已移出歌单。")
    return _redirect_playlist_detail(playlist)


@login_required
@require_POST
def playlist_reorder_track(request, username, pk, item_id):
    playlist = get_object_or_404(Playlist, pk=pk, creator=request.user, creator__username=username, is_deleted=False)
    playlist_track = get_object_or_404(PlaylistTrack, pk=item_id, playlist=playlist)
    try:
        target_position = max(0, int(request.POST.get("position", playlist_track.position)))
    except (TypeError, ValueError):
        messages.error(request, "排序必须是数字。")
        return _redirect_playlist_detail(playlist)
    items = list(playlist.playlist_tracks.exclude(pk=playlist_track.pk).order_by("position", "added_at"))
    target_position = min(target_position, len(items))
    items.insert(target_position, playlist_track)
    for index, item in enumerate(items):
        if item.position != index:
            item.position = index
            item.save(update_fields=["position"])
    playlist.save(update_fields=["updated_at"])
    messages.success(request, "排序已更新。")
    return _redirect_playlist_detail(playlist)


@login_required
@require_POST
def playlist_bulk_manage(request, username, pk):
    playlist = get_object_or_404(Playlist, pk=pk, creator=request.user, creator__username=username, is_deleted=False)
    form = PlaylistBulkManageForm(request.POST, playlist=playlist)
    if not form.is_valid() or not form.cleaned_data["selected_items"]:
        messages.error(request, "请选择要管理的歌曲。")
        return _redirect_playlist_detail(playlist)

    selected_items = list(form.cleaned_data["selected_items"])
    action = form.cleaned_data["action"]
    if action == "remove":
        PlaylistTrack.objects.filter(pk__in=[item.pk for item in selected_items], playlist=playlist).delete()
        playlist.track_count = playlist.playlist_tracks.count()
        messages.success(request, f"已移除 {len(selected_items)} 首歌曲。")
    elif action == "move_top":
        for index, item in enumerate(selected_items):
            item.position = index
            item.save(update_fields=["position"])
        messages.success(request, "选中的歌曲已移到顶部。")
    elif action == "move_bottom":
        max_position = playlist.playlist_tracks.order_by("-position").values_list("position", flat=True).first() or 0
        for index, item in enumerate(selected_items, start=1):
            item.position = max_position + index
            item.save(update_fields=["position"])
        messages.success(request, "选中的歌曲已移到底部。")

    playlist.save(update_fields=["track_count", "updated_at"] if action == "remove" else ["updated_at"])
    return _redirect_playlist_detail(playlist)


@login_required
@require_POST
def playlist_toggle_favorite(request, username, pk):
    playlist = get_object_or_404(
        Playlist,
        pk=pk,
        creator__username=username,
        visibility=Playlist.VISIBILITY_PUBLIC,
        playlist_type=Playlist.TYPE_NORMAL,
        is_deleted=False,
    )
    favorite, created = PlaylistFavorite.objects.get_or_create(user=request.user, playlist=playlist)
    if created:
        Playlist.objects.filter(pk=playlist.pk).update(favorite_count=F("favorite_count") + 1)
        messages.success(request, "已收藏歌单。")
    else:
        favorite.delete()
        Playlist.objects.filter(pk=playlist.pk, favorite_count__gt=0).update(favorite_count=F("favorite_count") - 1)
        messages.success(request, "已取消收藏。")
    return _redirect_playlist_detail(playlist)
