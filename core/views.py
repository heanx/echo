# -*- coding: utf-8 -*-
import mimetypes
from pathlib import Path

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.db.models import Case, IntegerField, Q, Value, When
from django.http import FileResponse, Http404, HttpResponse, JsonResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils._os import safe_join
from django.views.decorators.cache import never_cache

from albums.models import Album
from comments.models import TrackComment
from comments.queries import get_comment_page_context
from tracks.models import Track

from .forms import EchoAuthenticationForm, EchoUserCreationForm, UserProfileForm
from .models import UserProfile
from .utils import paginate_queryset


User = get_user_model()


def _file_chunk_iterator(file_obj, start, length, chunk_size=8192):
    file_obj.seek(start)
    remaining = length
    try:
        while remaining > 0:
            chunk = file_obj.read(min(chunk_size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk
    finally:
        file_obj.close()


def serve_media_range(request, path):
    if not settings.DEBUG:
        raise Http404
    try:
        full_path = safe_join(settings.MEDIA_ROOT, path)
    except ValueError as exc:
        raise Http404 from exc

    file_path = Path(full_path)
    if not file_path.is_file():
        raise Http404

    file_size = file_path.stat().st_size
    content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    range_header = request.headers.get("Range", "")

    if not range_header.startswith("bytes="):
        response = FileResponse(file_path.open("rb"), content_type=content_type)
        response["Accept-Ranges"] = "bytes"
        response["Content-Length"] = str(file_size)
        return response

    try:
        start_text, end_text = range_header.removeprefix("bytes=").split("-", 1)
        if start_text:
            start = int(start_text)
            end = int(end_text) if end_text else file_size - 1
        else:
            suffix_length = int(end_text)
            start = max(file_size - suffix_length, 0)
            end = file_size - 1
    except (TypeError, ValueError):
        return HttpResponse(status=416, headers={"Content-Range": f"bytes */{file_size}"})

    if start < 0 or end < start or start >= file_size:
        return HttpResponse(status=416, headers={"Content-Range": f"bytes */{file_size}"})

    end = min(end, file_size - 1)
    length = end - start + 1
    response = StreamingHttpResponse(
        _file_chunk_iterator(file_path.open("rb"), start, length),
        status=206,
        content_type=content_type,
    )
    response["Accept-Ranges"] = "bytes"
    response["Content-Length"] = str(length)
    response["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    return response


def _home_context(request):
    published_tracks = Track.objects.filter(status=Track.STATUS_PUBLISHED)
    recommended_tracks = list(published_tracks[:8])
    latest_tracks = list(published_tracks.order_by("-created_at")[:8])
    hot_albums = list(Album.objects.all()[:10])

    return {
        "hero_track": recommended_tracks[0] if recommended_tracks else None,
        "recommended_tracks": recommended_tracks,
        "latest_tracks": latest_tracks,
        "hot_albums": hot_albums,
    }


def home(request):
    return render(request, "core/home.html", _home_context(request))


def _playback_track(request):
    track_id = request.GET.get("track")
    if track_id:
        track = Track.objects.filter(pk=track_id, status=Track.STATUS_PUBLISHED).first()
        if track:
            return track
    return Track.objects.filter(status=Track.STATUS_PUBLISHED).order_by("-updated_at").first()


def _track_with_comments(request):
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
    return track or _playback_track(request)


def _track_with_lyrics(request):
    track_id = request.GET.get("track")
    if track_id:
        track = Track.objects.filter(pk=track_id, status=Track.STATUS_PUBLISHED).first()
        if track:
            return track

    track = (
        Track.objects.filter(status=Track.STATUS_PUBLISHED, lyrics_sets__is_primary=True)
        .distinct()
        .order_by("-lyrics_sets__updated_at")
        .first()
    )
    if track:
        return track
    track = (
        Track.objects.filter(status=Track.STATUS_PUBLISHED, lyrics_sets__isnull=False)
        .distinct()
        .order_by("-lyrics_sets__updated_at")
        .first()
    )
    return track or _playback_track(request)


def lyrics(request):
    track = _track_with_lyrics(request)
    lyrics_set = None
    lines = []
    if track:
        lyrics_set = track.lyrics_sets.filter(is_primary=True).first() or track.lyrics_sets.first()
        if lyrics_set:
            lines = lyrics_set.lines.order_by("position", "start_ms")

    return render(
        request,
        "core/lyrics.html",
        {
            "track": track,
            "lyrics_set": lyrics_set,
            "lyrics_lines": lines,
        },
    )


@never_cache
def comments(request):
    response = render(request, "core/comments.html", get_comment_page_context(request))
    response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response


def login_view(request):
    if request.user.is_authenticated:
        return redirect("home")

    form = EchoAuthenticationForm(request, data=request.POST or None)
    if request.method == "POST" and form.is_valid():
        login(request, form.get_user())
        request.session.set_expiry(60 * 60 * 24 * 30 if form.cleaned_data.get("remember_me") else 0)
        messages.success(request, "欢迎回来。")
        return redirect(request.GET.get("next") or "home")
    return render(request, "auth/login.html", {"form": form})


def register_view(request):
    if request.user.is_authenticated:
        return redirect("home")

    form = EchoUserCreationForm(request.POST or None, request.FILES or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        login(request, user)
        messages.success(request, "账号创建成功。")
        return redirect("home")
    return render(request, "auth/register.html", {"form": form})


@login_required
def logout_view(request):
    logout(request)
    messages.success(request, "你已经退出登录。")
    return redirect("home")


@login_required
def profile_settings(request):
    profile, _ = UserProfile.objects.get_or_create(
        user=request.user,
        defaults={"display_name": request.user.get_username()},
    )
    form = UserProfileForm(request.POST or None, request.FILES or None, instance=profile)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "个人资料已更新。")
        return redirect("profile", username=request.user.username)
    return render(request, "profile/settings.html", {"form": form})


def profile_view(request, username):
    profile_user = get_object_or_404(User, username=username)
    UserProfile.objects.get_or_create(
        user=profile_user,
        defaults={"display_name": profile_user.get_username()},
    )
    uploaded_tracks = Track.objects.filter(owner=profile_user, status=Track.STATUS_PUBLISHED).order_by("-created_at")
    recent_comments = TrackComment.objects.filter(user=profile_user, status=TrackComment.STATUS_PUBLISHED).select_related("track").order_by("-created_at")[:10]
    return render(
        request,
        "profile/detail.html",
        {
            "profile_user": profile_user,
            "uploaded_tracks": uploaded_tracks,
            "recent_comments": recent_comments,
        },
    )


SEARCH_TYPE_CHOICES = {"tracks", "albums", "users"}
SEARCH_TRACKS_PER_PAGE = 20
SEARCH_CARDS_PER_PAGE = 12


def _search_tracks(query):
    return (
        Track.objects.filter(status=Track.STATUS_PUBLISHED)
        .filter(
            Q(title__icontains=query)
            | Q(artist__icontains=query)
            | Q(description__icontains=query)
            | Q(owner__username__icontains=query)
            | Q(owner__profile__display_name__icontains=query)
        )
        .annotate(
            relevance=(
                Case(When(title__icontains=query, then=Value(100)), default=Value(0), output_field=IntegerField())
                + Case(When(artist__icontains=query, then=Value(80)), default=Value(0), output_field=IntegerField())
                + Case(When(owner__username__icontains=query, then=Value(50)), default=Value(0), output_field=IntegerField())
                + Case(When(owner__profile__display_name__icontains=query, then=Value(40)), default=Value(0), output_field=IntegerField())
                + Case(When(description__icontains=query, then=Value(10)), default=Value(0), output_field=IntegerField())
            )
        )
        .select_related("owner__profile")
        .distinct()
        .order_by("-relevance", "-created_at")
    )


def _search_albums(query):
    return (
        Album.objects.filter(
            Q(title__icontains=query) | Q(creator__icontains=query) | Q(description__icontains=query)
        )
        .annotate(
            relevance=(
                Case(When(title__icontains=query, then=Value(50)), default=Value(0), output_field=IntegerField())
                + Case(When(creator__icontains=query, then=Value(30)), default=Value(0), output_field=IntegerField())
                + Case(When(description__icontains=query, then=Value(5)), default=Value(0), output_field=IntegerField())
            )
        )
        .distinct()
        .order_by("-relevance", "-created_at")
    )


def _search_users(query):
    return (
        User.objects.filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(profile__display_name__icontains=query)
        )
        .select_related("profile")
        .distinct()
        .order_by("username")
    )


def _search_totals(tracks_qs, albums_qs, users_qs):
    return {
        "total_tracks": tracks_qs.count(),
        "total_albums": albums_qs.count(),
        "total_users": users_qs.count(),
    }


def _track_payload(track):
    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist or "Echo 用户",
        "audio_url": track.audio_url,
        "cover_theme": track.cover_theme or "summer",
        "cover_url": track.cover_url,
        "url": f"/tracks/{track.id}/",
    }


def search_suggest_view(request):
    query = request.GET.get("q", "").strip()[:200]
    if not query:
        return JsonResponse({"query": "", "suggestions": [], "tracks": []})

    tracks = list(_search_tracks(query)[:5])
    suggestion_values = []
    seen = set()
    for value in list(Track.objects.filter(status=Track.STATUS_PUBLISHED, title__icontains=query).values_list("title", flat=True)[:4]) + list(
        Track.objects.filter(status=Track.STATUS_PUBLISHED, artist__icontains=query).values_list("artist", flat=True)[:4]
    ) + list(Album.objects.filter(title__icontains=query).values_list("title", flat=True)[:3]):
        normalized = (value or "").strip()
        key = normalized.lower()
        if normalized and key not in seen:
            suggestion_values.append(normalized)
            seen.add(key)
        if len(suggestion_values) >= 4:
            break

    return JsonResponse(
        {
            "query": query,
            "suggestions": suggestion_values,
            "tracks": [_track_payload(track) for track in tracks],
        }
    )


def search_view(request):
    query = request.GET.get("q", "").strip()[:200]
    search_type = request.GET.get("type", "")
    if search_type not in SEARCH_TYPE_CHOICES:
        search_type = ""

    if not query:
        return render(
            request,
            "search/results.html",
            {
                "query": query,
                "tracks": Track.objects.none(),
                "albums": Album.objects.none(),
                "users": User.objects.none(),
                "active_type": "",
                "total_tracks": 0,
                "total_albums": 0,
                "total_users": 0,
            },
        )

    tracks_qs = _search_tracks(query)
    albums_qs = _search_albums(query)
    users_qs = _search_users(query)
    totals = _search_totals(tracks_qs, albums_qs, users_qs)

    if search_type == "tracks":
        page_obj, pagination, page_notice = paginate_queryset(request, tracks_qs, default_per_page=SEARCH_TRACKS_PER_PAGE)
        return render(
            request,
            "search/results.html",
            {
                "query": query,
                "tracks": page_obj.object_list,
                "albums": Album.objects.none(),
                "users": User.objects.none(),
                "page_obj": page_obj,
                "pagination": pagination,
                "page_notice": page_notice,
                "active_type": "tracks",
                **totals,
            },
        )

    if search_type == "albums":
        page_obj, pagination, page_notice = paginate_queryset(request, albums_qs, default_per_page=SEARCH_CARDS_PER_PAGE)
        return render(
            request,
            "search/results.html",
            {
                "query": query,
                "tracks": Track.objects.none(),
                "albums": page_obj.object_list,
                "users": User.objects.none(),
                "page_obj": page_obj,
                "pagination": pagination,
                "page_notice": page_notice,
                "active_type": "albums",
                **totals,
            },
        )

    if search_type == "users":
        page_obj, pagination, page_notice = paginate_queryset(request, users_qs, default_per_page=SEARCH_CARDS_PER_PAGE)
        return render(
            request,
            "search/results.html",
            {
                "query": query,
                "tracks": Track.objects.none(),
                "albums": Album.objects.none(),
                "users": page_obj.object_list,
                "page_obj": page_obj,
                "pagination": pagination,
                "page_notice": page_notice,
                "active_type": "users",
                **totals,
            },
        )

    summary_tracks = list(tracks_qs[:21])
    return render(
        request,
        "search/results.html",
        {
            "query": query,
            "best_track": summary_tracks[0] if summary_tracks else None,
            "tracks": summary_tracks[1:21],
            "albums": albums_qs[:6],
            "users": users_qs[:6],
            "active_type": "",
            **totals,
        },
    )


def error_404(request, exception):
    return render(request, "errors/404.html", status=404)


def error_500(request):
    return render(request, "errors/500.html", status=500)
