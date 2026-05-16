from django.contrib import messages
from django.contrib.auth import get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.cache import never_cache

from albums.models import Album
from comments.models import TrackComment
from comments.queries import get_comment_page_context
from tracks.models import Track

from .forms import AccountSecurityForm, EchoAuthenticationForm, EchoUserCreationForm, UserProfileForm
from .models import UserProfile


User = get_user_model()


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


def search_view(request):
    query = request.GET.get("q", "").strip()
    tracks = Track.objects.none()
    albums = Album.objects.none()
    users = User.objects.none()
    if query:
        tracks = Track.objects.filter(
            status=Track.STATUS_PUBLISHED
        ).filter(
            Q(title__icontains=query)
            | Q(artist__icontains=query)
            | Q(description__icontains=query)
            | Q(owner__username__icontains=query)
            | Q(owner__profile__display_name__icontains=query)
        ).distinct()
        albums = Album.objects.filter(
            Q(title__icontains=query) | Q(creator__icontains=query) | Q(description__icontains=query)
        ).distinct()[:6]
        users = User.objects.filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(profile__display_name__icontains=query)
        ).select_related("profile").distinct()[:6]
    return render(
        request,
        "search/results.html",
        {
            "query": query,
            "tracks": tracks[:20] if query else tracks,
            "albums": albums,
            "users": users,
        },
    )


def error_404(request, exception):
    return render(request, "errors/404.html", status=404)


def error_500(request):
    return render(request, "errors/500.html", status=500)
