from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render

from tracks.models import Track
from tracks.upload_validation import (
    ALLOWED_LYRICS_EXTENSIONS,
    MAX_LYRICS_SIZE,
    validate_upload_file,
)

from .models import TrackLyrics


def _lyrics_track_queryset(user):
    queryset = Track.objects.exclude(status=Track.STATUS_DELETED)
    if user.is_staff:
        return queryset
    return queryset.filter(Q(status=Track.STATUS_PUBLISHED) | Q(owner=user))


@login_required
def upload_lyrics(request):
    available_tracks = _lyrics_track_queryset(request.user).order_by("-created_at")
    tracks = Track.objects.filter(status=Track.STATUS_PUBLISHED).order_by("-created_at")[:50]
    lyric_statuses = TrackLyrics.STATUS_CHOICES
    lyrics_kinds = TrackLyrics.KIND_CHOICES
    selected_track = None
    track_id = request.GET.get("track") or request.POST.get("track")
    if track_id:
        selected_track = get_object_or_404(available_tracks, pk=track_id)

    if request.method == "POST":
        track = selected_track or get_object_or_404(available_tracks, pk=request.POST.get("track"))
        lyric_status = request.POST.get("status", TrackLyrics.STATUS_AVAILABLE)
        if lyric_status not in dict(TrackLyrics.STATUS_CHOICES):
            lyric_status = TrackLyrics.STATUS_AVAILABLE
        lyric_kind = request.POST.get("kind", TrackLyrics.KIND_ORIGINAL)
        if lyric_kind not in dict(TrackLyrics.KIND_CHOICES):
            lyric_kind = TrackLyrics.KIND_ORIGINAL
        raw_text = request.POST.get("raw_text", "").strip()
        source_file = request.FILES.get("source_file")
        upload_error = validate_upload_file(source_file, ALLOWED_LYRICS_EXTENSIONS, MAX_LYRICS_SIZE, "歌词文件", "lyrics")
        if upload_error:
            return render(
                request,
                "lyrics/upload.html",
                {
                    "tracks": tracks,
                    "selected_track": selected_track,
                    "lyric_statuses": lyric_statuses,
                    "lyrics_kinds": lyrics_kinds,
                    "error": upload_error,
                },
            )
        if lyric_status != TrackLyrics.STATUS_AVAILABLE:
            raw_text = ""
            source_file = None
        elif source_file and not raw_text:
            raw_text = source_file.read().decode("utf-8", errors="ignore")
            source_file.seek(0)

        lyrics, _ = TrackLyrics.objects.update_or_create(
            track=track,
            language=request.POST.get("language", "zh-Hans").strip() or "zh-Hans",
            kind=lyric_kind,
            defaults={
                "raw_text": raw_text,
                "source_file": source_file,
                "status": lyric_status,
                "parser_version": "simple-lrc-v1" if lyric_status == TrackLyrics.STATUS_AVAILABLE else lyric_status,
                "is_primary": True,
            },
        )
        lyrics.parse_raw_text()
        return redirect(f"/lyrics/?track={track.pk}")

    return render(
        request,
        "lyrics/upload.html",
        {
            "tracks": tracks,
            "selected_track": selected_track,
            "lyric_statuses": lyric_statuses,
            "lyrics_kinds": lyrics_kinds,
        },
    )
