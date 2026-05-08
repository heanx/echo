from django.shortcuts import render
from django.views.decorators.cache import never_cache

from albums.models import Album
from comments.models import TrackComment
from comments.queries import get_comment_page_context
from tracks.models import Track


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
