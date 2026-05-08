from django.shortcuts import get_object_or_404, redirect, render

from lyrics.models import TrackLyrics

from .models import Track


def track_list(request):
    tracks = Track.objects.filter(status=Track.STATUS_PUBLISHED)
    return render(request, "tracks/list.html", {"tracks": tracks, "page_title": "全部音乐"})


def latest_tracks(request):
    tracks = Track.objects.filter(status=Track.STATUS_PUBLISHED).order_by("-created_at")
    return render(request, "tracks/list.html", {"tracks": tracks, "page_title": "最新上传"})


def upload_track(request):
    context = {
        "cover_themes": ["summer", "night", "forest", "ocean", "city", "sea", "signal", "sunset"],
        "lyrics_kinds": TrackLyrics.KIND_CHOICES,
    }

    if request.method == "POST":
        title = request.POST.get("title", "").strip()
        if not title:
            context["error"] = "标题不能为空"
            context["form_data"] = request.POST
            return render(request, "tracks/upload.html", context)

        try:
            duration_ms = int(request.POST.get("duration_ms") or 0)
        except ValueError:
            duration_ms = 0

        status = request.POST.get("status", Track.STATUS_PUBLISHED)
        if status not in dict(Track.STATUS_CHOICES):
            status = Track.STATUS_PUBLISHED

        track = Track.objects.create(
            title=title,
            artist=request.POST.get("artist", "").strip(),
            description=request.POST.get("description", "").strip(),
            cover_theme=request.POST.get("cover_theme", "summer").strip() or "summer",
            audio_file=request.FILES.get("audio_file"),
            cover_image=request.FILES.get("cover_image"),
            duration_ms=duration_ms,
            status=status,
        )

        raw_lyrics = request.POST.get("lyrics_raw_text", "").strip()
        lyrics_file = request.FILES.get("lyrics_file")
        if lyrics_file and not raw_lyrics:
            raw_lyrics = lyrics_file.read().decode("utf-8", errors="ignore").strip()
            lyrics_file.seek(0)

        if raw_lyrics or lyrics_file:
            lyrics = TrackLyrics.objects.create(
                track=track,
                language=request.POST.get("lyrics_language", "zh-Hans").strip() or "zh-Hans",
                kind=request.POST.get("lyrics_kind", TrackLyrics.KIND_ORIGINAL),
                raw_text=raw_lyrics,
                source_file=lyrics_file,
                parser_version="simple-lrc-v1",
                is_primary=True,
            )
            lyrics.parse_raw_text()
        return redirect("tracks:detail", pk=track.pk)

    return render(request, "tracks/upload.html", context)


def track_detail(request, pk):
    track = get_object_or_404(Track, pk=pk, status=Track.STATUS_PUBLISHED)
    return render(request, "tracks/detail.html", {"track": track})
