from django.shortcuts import get_object_or_404, redirect, render

from tracks.models import Track

from .models import TrackLyrics


def upload_lyrics(request):
    tracks = Track.objects.all()[:50]
    lyric_statuses = TrackLyrics.STATUS_CHOICES
    selected_track = None
    track_id = request.GET.get("track") or request.POST.get("track")
    if track_id:
        selected_track = get_object_or_404(Track, pk=track_id)

    if request.method == "POST":
        track = selected_track or get_object_or_404(Track, pk=request.POST.get("track"))
        lyric_status = request.POST.get("status", TrackLyrics.STATUS_AVAILABLE)
        if lyric_status not in dict(TrackLyrics.STATUS_CHOICES):
            lyric_status = TrackLyrics.STATUS_AVAILABLE
        raw_text = request.POST.get("raw_text", "").strip()
        source_file = request.FILES.get("source_file")
        if lyric_status != TrackLyrics.STATUS_AVAILABLE:
            raw_text = ""
            source_file = None
        elif source_file and not raw_text:
            raw_text = source_file.read().decode("utf-8", errors="ignore")

        lyrics, _ = TrackLyrics.objects.update_or_create(
            track=track,
            language=request.POST.get("language", "zh-Hans").strip() or "zh-Hans",
            kind=request.POST.get("kind", TrackLyrics.KIND_ORIGINAL),
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
            "lyrics_kinds": TrackLyrics.KIND_CHOICES,
        },
    )
