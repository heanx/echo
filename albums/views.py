from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from .forms import PlaylistForm, PlaylistTrackForm
from .models import Album, Playlist, PlaylistTrack


def album_list(request):
    albums = Album.objects.all()
    playlists = Playlist.objects.filter(Q(is_public=True) | Q(owner=request.user) if request.user.is_authenticated else Q(is_public=True)).select_related("owner")[:12]
    return render(request, "albums/list.html", {"albums": albums, "playlists": playlists})


def playlist_list(request):
    playlists = Playlist.objects.filter(is_public=True).select_related("owner")
    if request.user.is_authenticated:
        playlists = Playlist.objects.filter(Q(is_public=True) | Q(owner=request.user)).select_related("owner").distinct()
    return render(request, "albums/playlist_list.html", {"playlists": playlists})


@login_required
def playlist_create(request):
    form = PlaylistForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        playlist = form.save(commit=False)
        playlist.owner = request.user
        playlist.save()
        messages.success(request, "歌单已创建。")
        return redirect("albums:playlist_detail", pk=playlist.pk)
    return render(request, "albums/playlist_form.html", {"form": form, "page_title": "创建歌单"})


def playlist_detail(request, pk):
    queryset = Playlist.objects.select_related("owner").prefetch_related("playlist_tracks__track")
    if request.user.is_authenticated:
        playlist = get_object_or_404(queryset.filter(Q(is_public=True) | Q(owner=request.user)).distinct(), pk=pk)
    else:
        playlist = get_object_or_404(queryset, pk=pk, is_public=True)
    add_form = PlaylistTrackForm(playlist=playlist) if request.user == playlist.owner else None
    return render(request, "albums/playlist_detail.html", {"playlist": playlist, "add_form": add_form})


@login_required
def playlist_edit(request, pk):
    playlist = get_object_or_404(Playlist, pk=pk, owner=request.user)
    form = PlaylistForm(request.POST or None, instance=playlist)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "歌单已更新。")
        return redirect("albums:playlist_detail", pk=playlist.pk)
    return render(request, "albums/playlist_form.html", {"form": form, "page_title": "编辑歌单", "playlist": playlist})


@login_required
@require_POST
def playlist_delete(request, pk):
    playlist = get_object_or_404(Playlist, pk=pk, owner=request.user)
    playlist.delete()
    messages.success(request, "歌单已删除。")
    return redirect("albums:playlists")


@login_required
@require_POST
def playlist_add_track(request, pk):
    playlist = get_object_or_404(Playlist, pk=pk, owner=request.user)
    form = PlaylistTrackForm(request.POST, playlist=playlist)
    if form.is_valid():
        playlist_track = form.save(commit=False)
        playlist_track.playlist = playlist
        playlist_track.save()
        playlist.save(update_fields=["updated_at"])
        messages.success(request, "歌曲已加入歌单。")
    else:
        messages.error(request, "歌曲没有添加成功，请确认没有重复添加。")
    return redirect("albums:playlist_detail", pk=playlist.pk)


@login_required
@require_POST
def playlist_remove_track(request, pk, item_id):
    playlist = get_object_or_404(Playlist, pk=pk, owner=request.user)
    get_object_or_404(PlaylistTrack, pk=item_id, playlist=playlist).delete()
    playlist.save(update_fields=["updated_at"])
    messages.success(request, "歌曲已移出歌单。")
    return redirect("albums:playlist_detail", pk=playlist.pk)


@login_required
@require_POST
def playlist_reorder_track(request, pk, item_id):
    playlist = get_object_or_404(Playlist, pk=pk, owner=request.user)
    playlist_track = get_object_or_404(PlaylistTrack, pk=item_id, playlist=playlist)
    try:
        playlist_track.position = max(0, int(request.POST.get("position", playlist_track.position)))
    except (TypeError, ValueError):
        messages.error(request, "排序必须是数字。")
        return redirect("albums:playlist_detail", pk=playlist.pk)
    playlist_track.save(update_fields=["position"])
    playlist.save(update_fields=["updated_at"])
    messages.success(request, "排序已更新。")
    return redirect("albums:playlist_detail", pk=playlist.pk)
