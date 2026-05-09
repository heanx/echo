from pathlib import Path

from django.db.models import F
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from lyrics.models import TrackLyrics

from .models import Track


ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".webm"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_AUDIO_SIZE = 50 * 1024 * 1024
MAX_IMAGE_SIZE = 8 * 1024 * 1024


def _validate_upload_file(uploaded_file, allowed_extensions, max_size, label):
    if not uploaded_file:
        return ""

    extension = Path(uploaded_file.name).suffix.lower()
    if extension not in allowed_extensions:
        allowed = "、".join(sorted(allowed_extensions))
        return f"{label}格式不支持，请上传 {allowed} 文件"
    if uploaded_file.size > max_size:
        limit_mb = max_size // (1024 * 1024)
        return f"{label}不能超过 {limit_mb}MB"
    return ""


def _decode_id3_text(payload):
    if not payload:
        return ""
    encoding = payload[0]
    data = payload[1:]
    try:
        if encoding == 1:
            return data.decode("utf-16", errors="ignore").strip("\x00 \ufeff")
        if encoding == 2:
            return data.decode("utf-16-be", errors="ignore").strip("\x00 \ufeff")
        if encoding == 3:
            return data.decode("utf-8", errors="ignore").strip("\x00 \ufeff")
        return data.decode("latin-1", errors="ignore").strip("\x00 \ufeff")
    except UnicodeError:
        return ""


def _syncsafe_to_int(raw):
    return ((raw[0] & 0x7F) << 21) | ((raw[1] & 0x7F) << 14) | ((raw[2] & 0x7F) << 7) | (raw[3] & 0x7F)


def _read_audio_metadata(uploaded_file):
    metadata = {}
    if not uploaded_file:
        return metadata

    original_position = uploaded_file.tell()
    try:
        uploaded_file.seek(0)
        header = uploaded_file.read(10)
        if len(header) < 10 or header[:3] != b"ID3":
            return metadata

        version = header[3]
        tag_size = _syncsafe_to_int(header[6:10])
        tag_data = uploaded_file.read(min(tag_size, 1024 * 1024))
        offset = 0
        while offset + 10 <= len(tag_data):
            frame_header = tag_data[offset : offset + 10]
            frame_id = frame_header[:4].decode("latin-1", errors="ignore").strip("\x00")
            if not frame_id:
                break
            frame_size = _syncsafe_to_int(frame_header[4:8]) if version == 4 else int.from_bytes(frame_header[4:8], "big")
            if frame_size <= 0 or offset + 10 + frame_size > len(tag_data):
                break
            payload = tag_data[offset + 10 : offset + 10 + frame_size]
            if frame_id == "TIT2":
                metadata["title"] = _decode_id3_text(payload)
            elif frame_id == "TPE1":
                metadata["artist"] = _decode_id3_text(payload)
            elif frame_id == "TALB":
                metadata["album"] = _decode_id3_text(payload)
            offset += 10 + frame_size
    finally:
        uploaded_file.seek(original_position)

    return {key: value for key, value in metadata.items() if value}


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
        "lyric_statuses": TrackLyrics.STATUS_CHOICES,
    }

    if request.method == "POST":
        title = request.POST.get("title", "").strip()
        audio_file = request.FILES.get("audio_file")
        cover_image = request.FILES.get("cover_image")
        if not audio_file:
            context["error"] = "请上传一个真实的音频文件"
            context["form_data"] = request.POST
            return render(request, "tracks/upload.html", context)

        upload_error = (
            _validate_upload_file(audio_file, ALLOWED_AUDIO_EXTENSIONS, MAX_AUDIO_SIZE, "音频文件")
            or _validate_upload_file(cover_image, ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_SIZE, "封面图片")
        )
        if upload_error:
            context["error"] = upload_error
            context["form_data"] = request.POST
            return render(request, "tracks/upload.html", context)

        audio_metadata = _read_audio_metadata(audio_file)
        title = title or audio_metadata.get("title", "")
        if not title:
            context["error"] = "没有从音频文件中读取到标题，请手动填写标题"
            context["form_data"] = request.POST
            return render(request, "tracks/upload.html", context)

        artist = request.POST.get("artist", "").strip() or audio_metadata.get("artist", "")
        description = request.POST.get("description", "").strip()
        if audio_metadata.get("album") and not description:
            description = f"专辑：{audio_metadata['album']}"

        try:
            duration_ms = max(0, int(request.POST.get("duration_ms") or 0))
        except ValueError:
            duration_ms = 0

        status = request.POST.get("status", Track.STATUS_PUBLISHED)
        if status not in dict(Track.STATUS_CHOICES):
            status = Track.STATUS_PUBLISHED

        track = Track.objects.create(
            title=title,
            artist=artist,
            description=description,
            cover_theme=request.POST.get("cover_theme", "summer").strip() or "summer",
            audio_file=audio_file,
            cover_image=cover_image,
            duration_ms=duration_ms,
            status=status,
        )

        raw_lyrics = request.POST.get("lyrics_raw_text", "").strip()
        lyrics_file = request.FILES.get("lyrics_file")
        lyric_status = request.POST.get("lyrics_status", TrackLyrics.STATUS_AVAILABLE)
        if lyric_status not in dict(TrackLyrics.STATUS_CHOICES):
            lyric_status = TrackLyrics.STATUS_AVAILABLE

        if lyric_status != TrackLyrics.STATUS_AVAILABLE:
            raw_lyrics = ""
            lyrics_file = None
        elif lyrics_file and not raw_lyrics:
            raw_lyrics = lyrics_file.read().decode("utf-8", errors="ignore").strip()
            lyrics_file.seek(0)

        if raw_lyrics or lyrics_file or lyric_status != TrackLyrics.STATUS_AVAILABLE:
            lyrics = TrackLyrics.objects.create(
                track=track,
                language=request.POST.get("lyrics_language", "zh-Hans").strip() or "zh-Hans",
                kind=request.POST.get("lyrics_kind", TrackLyrics.KIND_ORIGINAL),
                status=lyric_status,
                raw_text=raw_lyrics,
                source_file=lyrics_file,
                parser_version="simple-lrc-v1" if lyric_status == TrackLyrics.STATUS_AVAILABLE else lyric_status,
                is_primary=True,
            )
            lyrics.parse_raw_text()
        return redirect("tracks:detail", pk=track.pk)

    return render(request, "tracks/upload.html", context)


def track_detail(request, pk):
    track = get_object_or_404(Track, pk=pk, status=Track.STATUS_PUBLISHED)
    return render(request, "tracks/detail.html", {"track": track})


@require_POST
def record_play(request, pk):
    updated = Track.objects.filter(pk=pk, status=Track.STATUS_PUBLISHED).update(plays=F("plays") + 1)
    if not updated:
        return JsonResponse({"ok": False, "error": "track_not_found"}, status=404)

    plays = Track.objects.filter(pk=pk).values_list("plays", flat=True).first()
    return JsonResponse({"ok": True, "track_id": pk, "plays": plays or 0})
