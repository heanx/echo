import os
import mimetypes

from django.contrib import messages
from django.contrib.auth import get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseNotAllowed, JsonResponse
from django.db.models import Case, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.cache import never_cache
from django.views.static import serve

from albums.models import Album, Playlist
from comments.models import TrackComment
from comments.queries import get_comment_page_context
from tracks.models import Track
from tracks.views import _paginate_queryset, liked_track_ids_for

from .forms import AccountSecurityForm, EchoAuthenticationForm, EchoUserCreationForm, UserProfileForm
from .models import Notification, UserProfile


User = get_user_model()
SEARCH_TYPE_CHOICES = {"tracks", "albums", "playlists", "users"}
SEARCH_TRACKS_PER_PAGE = 20
SEARCH_CARDS_PER_PAGE = 12


def _home_context(request):
    published_tracks = Track.objects.filter(status=Track.STATUS_PUBLISHED)
    recommended_tracks = list(published_tracks[:8])
    latest_tracks = list(published_tracks.order_by("-created_at")[:8])
    hot_albums = list(Album.objects.all()[:10])
    visible_tracks = recommended_tracks + latest_tracks

    return {
        "hero_track": recommended_tracks[0] if recommended_tracks else None,
        "recommended_tracks": recommended_tracks,
        "latest_tracks": latest_tracks,
        "hot_albums": hot_albums,
        "liked_track_ids": liked_track_ids_for(request.user, visible_tracks),
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
        next_url = request.GET.get("next")
        if next_url and url_has_allowed_host_and_scheme(
            next_url,
            allowed_hosts={request.get_host()},
            require_https=request.is_secure(),
        ):
            return redirect(next_url)
        return redirect("home")
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
        profile = form.save()
        messages.success(request, "个人资料已更新。")
        return redirect("profile", username=profile.user.username)
    return render(request, "profile/settings.html", {"form": form})


@login_required
def account_security(request):
    form = AccountSecurityForm(request.POST or None, user=request.user)
    if request.method == "POST" and form.is_valid():
        user, password_changed = form.save()
        if password_changed:
            update_session_auth_hash(request, user)
        messages.success(request, "账户安全设置已更新。")
        return redirect("profile", username=user.username)
    return render(request, "profile/security.html", {"form": form})


def profile_view(request, username):
    profile_user = get_object_or_404(User, username=username)
    UserProfile.objects.get_or_create(
        user=profile_user,
        defaults={"display_name": profile_user.get_username()},
    )
    uploaded_tracks = Track.objects.filter(owner=profile_user, status=Track.STATUS_PUBLISHED).order_by("-created_at")
    uploaded_track_items = list(uploaded_tracks)
    recent_comments = TrackComment.objects.filter(user=profile_user, status=TrackComment.STATUS_PUBLISHED).select_related("track").order_by("-created_at")[:10]
    public_playlists = Playlist.objects.filter(
        creator=profile_user,
        visibility=Playlist.VISIBILITY_PUBLIC,
        playlist_type=Playlist.TYPE_NORMAL,
        is_deleted=False,
    ).select_related("creator")[:6]
    profile_stats = {
        "joined_at": profile_user.date_joined,
        "uploaded_count": len(uploaded_track_items),
        "comment_count": TrackComment.objects.filter(user=profile_user, status=TrackComment.STATUS_PUBLISHED).count(),
        "playlist_count": Playlist.objects.filter(
            creator=profile_user,
            visibility=Playlist.VISIBILITY_PUBLIC,
            playlist_type=Playlist.TYPE_NORMAL,
            is_deleted=False,
        ).count(),
    }
    return render(
        request,
        "profile/detail.html",
        {
            "profile_user": profile_user,
            "uploaded_tracks": uploaded_track_items,
            "recent_comments": recent_comments,
            "public_playlists": public_playlists,
            "profile_stats": profile_stats,
            "liked_track_ids": liked_track_ids_for(request.user, uploaded_track_items),
        },
    )


@login_required
def notifications(request):
    items = request.user.notifications.select_related("actor")[:50]
    return render(request, "core/notifications.html", {"notifications": items})


@login_required
def mark_notification_read(request, pk):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
    notification.is_read = True
    notification.save(update_fields=["is_read"])
    return redirect(notification.target_url or "notifications")


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
        .select_related("owner", "owner__profile")
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


def _search_playlists(query):
    return (
        Playlist.objects.filter(
            visibility=Playlist.VISIBILITY_PUBLIC,
            playlist_type=Playlist.TYPE_NORMAL,
            is_deleted=False,
        )
        .filter(
            Q(title__icontains=query)
            | Q(description__icontains=query)
            | Q(creator__username__icontains=query)
            | Q(creator__profile__display_name__icontains=query)
        )
        .annotate(
            relevance=(
                Case(When(title__icontains=query, then=Value(80)), default=Value(0), output_field=IntegerField())
                + Case(When(creator__username__icontains=query, then=Value(45)), default=Value(0), output_field=IntegerField())
                + Case(When(creator__profile__display_name__icontains=query, then=Value(35)), default=Value(0), output_field=IntegerField())
                + Case(When(description__icontains=query, then=Value(10)), default=Value(0), output_field=IntegerField())
            )
        )
        .select_related("creator", "creator__profile")
        .distinct()
        .order_by("-relevance", "-updated_at")
    )


def _search_totals(tracks_qs, albums_qs, playlists_qs, users_qs):
    return {
        "total_tracks": tracks_qs.count(),
        "total_albums": albums_qs.count(),
        "total_playlists": playlists_qs.count(),
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


def _playlist_payload(playlist):
    return {
        "id": playlist.id,
        "title": playlist.title,
        "creator": playlist.creator_name,
        "track_count": playlist.track_count,
        "cover_theme": playlist.cover_theme or "eclipse",
        "cover_url": playlist.cover_url,
        "url": f"/users/{playlist.creator.username}/playlist/{playlist.id}/",
    }


def search_suggest_view(request):
    query = request.GET.get("q", "").strip()[:200]
    if not query:
        return JsonResponse({"query": "", "suggestions": [], "tracks": []})

    tracks = list(_search_tracks(query)[:5])
    playlists = list(_search_playlists(query)[:4])
    suggestion_values = []
    seen = set()
    values = list(Track.objects.filter(status=Track.STATUS_PUBLISHED, title__icontains=query).values_list("title", flat=True)[:4])
    values += list(Track.objects.filter(status=Track.STATUS_PUBLISHED, artist__icontains=query).values_list("artist", flat=True)[:4])
    values += list(Album.objects.filter(title__icontains=query).values_list("title", flat=True)[:3])
    values += list(
        Playlist.objects.filter(
            visibility=Playlist.VISIBILITY_PUBLIC,
            playlist_type=Playlist.TYPE_NORMAL,
            is_deleted=False,
            title__icontains=query,
        ).values_list("title", flat=True)[:3]
    )
    for value in values:
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
            "playlists": [_playlist_payload(playlist) for playlist in playlists],
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
                "playlists": Playlist.objects.none(),
                "users": User.objects.none(),
                "active_type": "",
                "total_tracks": 0,
                "total_albums": 0,
                "total_playlists": 0,
                "total_users": 0,
            },
        )

    tracks_qs = _search_tracks(query)
    albums_qs = _search_albums(query)
    playlists_qs = _search_playlists(query)
    users_qs = _search_users(query)
    totals = _search_totals(tracks_qs, albums_qs, playlists_qs, users_qs)

    if search_type == "tracks":
        page_obj, pagination, page_notice = _paginate_queryset(request, tracks_qs, default_per_page=SEARCH_TRACKS_PER_PAGE)
        track_items = list(page_obj.object_list)
        return render(
            request,
            "search/results.html",
            {
                "query": query,
                "tracks": track_items,
                "albums": Album.objects.none(),
                "playlists": Playlist.objects.none(),
                "users": User.objects.none(),
                "page_obj": page_obj,
                "pagination": pagination,
                "page_notice": page_notice,
                "active_type": "tracks",
                "liked_track_ids": liked_track_ids_for(request.user, track_items),
                **totals,
            },
        )

    if search_type == "albums":
        page_obj, pagination, page_notice = _paginate_queryset(request, albums_qs, default_per_page=SEARCH_CARDS_PER_PAGE)
        return render(
            request,
            "search/results.html",
            {
                "query": query,
                "tracks": Track.objects.none(),
                "albums": page_obj.object_list,
                "playlists": Playlist.objects.none(),
                "users": User.objects.none(),
                "page_obj": page_obj,
                "pagination": pagination,
                "page_notice": page_notice,
                "active_type": "albums",
                **totals,
            },
        )

    if search_type == "playlists":
        page_obj, pagination, page_notice = _paginate_queryset(request, playlists_qs, default_per_page=SEARCH_CARDS_PER_PAGE)
        return render(
            request,
            "search/results.html",
            {
                "query": query,
                "tracks": Track.objects.none(),
                "albums": Album.objects.none(),
                "playlists": page_obj.object_list,
                "users": User.objects.none(),
                "page_obj": page_obj,
                "pagination": pagination,
                "page_notice": page_notice,
                "active_type": "playlists",
                **totals,
            },
        )

    if search_type == "users":
        page_obj, pagination, page_notice = _paginate_queryset(request, users_qs, default_per_page=SEARCH_CARDS_PER_PAGE)
        return render(
            request,
            "search/results.html",
            {
                "query": query,
                "tracks": Track.objects.none(),
                "albums": Album.objects.none(),
                "playlists": Playlist.objects.none(),
                "users": page_obj.object_list,
                "page_obj": page_obj,
                "pagination": pagination,
                "page_notice": page_notice,
                "active_type": "users",
                **totals,
            },
        )

    summary_tracks = list(tracks_qs[:21])
    visible_tracks = summary_tracks
    return render(
        request,
        "search/results.html",
        {
            "query": query,
            "best_track": summary_tracks[0] if summary_tracks else None,
            "tracks": summary_tracks[1:21],
            "albums": albums_qs[:6],
            "playlists": playlists_qs[:6],
            "users": users_qs[:6],
            "active_type": "",
            "liked_track_ids": liked_track_ids_for(request.user, visible_tracks),
            **totals,
        },
    )


def serve_audio(request, path):
    """Serve media/static files with HTTP Range support for audio seeking."""
    from django.conf import settings

    # Try static first, then media
    full_path = None
    for root in [settings.STATIC_ROOT, settings.MEDIA_ROOT] + list(settings.STATICFILES_DIRS):
        candidate = os.path.join(root, path)
        if os.path.isfile(candidate):
            full_path = candidate
            break

    if full_path is None:
        return HttpResponse(status=404)

    content_type, _ = mimetypes.guess_type(full_path)
    file_size = os.path.getsize(full_path)

    range_header = request.headers.get("HTTP_RANGE") or request.headers.get("Range") or ""
    range_match = None
    if range_header:
        import re
        range_match = re.match(r"bytes=(\d+)-(\d*)", range_header)

    if range_match:
        start = int(range_match.group(1))
        end_str = range_match.group(2)
        end = int(end_str) - 1 if end_str else file_size - 1
        end = min(end, file_size - 1)

        if start > end or start >= file_size:
            return HttpResponse(status=416)

        length = end - start + 1
        with open(full_path, "rb") as f:
            f.seek(start)
            data = f.read(length)

        response = HttpResponse(data, content_type=content_type, status=206)
        response["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        response["Content-Length"] = str(length)
    else:
        response = HttpResponse(open(full_path, "rb").read(), content_type=content_type)
        response["Content-Length"] = str(file_size)

    response["Accept-Ranges"] = "bytes"
    return response


def error_404(request, exception):
    return render(request, "errors/404.html", status=404)


def error_500(request):
    return render(request, "errors/500.html", status=500)
