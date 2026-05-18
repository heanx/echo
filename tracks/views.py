from django.contrib.auth.decorators import login_required
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.db.models import F
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from lyrics.models import TrackLyrics

from .models import Track
from .upload_validation import (
    ALLOWED_AUDIO_EXTENSIONS,
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_LYRICS_EXTENSIONS,
    MAX_AUDIO_SIZE,
    MAX_IMAGE_SIZE,
    MAX_LYRICS_SIZE,
    validate_upload_file,
)


DEFAULT_PER_PAGE = 20
MAX_PER_PAGE = 100


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


def _parse_positive_int(value, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _build_page_links(page_obj, build_url=None):
    current = page_obj.number
    last = page_obj.paginator.num_pages
    if last <= 7:
        pages = list(range(1, last + 1))
    else:
        pages = [1]
        window_start = max(2, current - 1)
        window_end = min(last - 1, current + 1)
        if window_start > 2:
            pages.append(None)
        pages.extend(range(window_start, window_end + 1))
        if window_end < last - 1:
            pages.append(None)
        pages.append(last)

    links = []
    for page_number in pages:
        links.append(
            {
                "number": page_number,
                "is_gap": page_number is None,
                "is_current": page_number == current,
                "url": build_url(page_number) if page_number and build_url else "",
            }
        )
    return links


def _paginate_queryset(request, queryset, default_per_page=DEFAULT_PER_PAGE):
    per_page = min(_parse_positive_int(request.GET.get("per"), default_per_page), MAX_PER_PAGE)
    paginator = Paginator(queryset, per_page)
    requested_page = request.GET.get("page", 1)
    page_notice = ""

    try:
        page_obj = paginator.page(requested_page)
    except PageNotAnInteger:
        page_obj = paginator.page(1)
        page_notice = "页码无效，已为你跳转到第 1 页。"
    except EmptyPage:
        target_page = paginator.num_pages or 1
        page_obj = paginator.page(target_page)
        page_notice = f"请求的页码超出范围，已为你跳转到第 {target_page} 页。"

    params = request.GET.copy()
    params["per"] = per_page
    params.pop("page", None)

    def build_url(page_number):
        page_params = params.copy()
        page_params["page"] = page_number
        return f"{request.path}?{page_params.urlencode()}"

    pagination = {
        "has_other_pages": page_obj.has_other_pages(),
        "page_links": _build_page_links(page_obj, build_url=build_url),
        "current_page": page_obj.number,
        "total_pages": paginator.num_pages,
        "per_page": per_page,
        "total_items": paginator.count,
        "start_index": page_obj.start_index() if paginator.count else 0,
        "end_index": page_obj.end_index() if paginator.count else 0,
        "prev_url": build_url(page_obj.previous_page_number()) if page_obj.has_previous() else "",
        "next_url": build_url(page_obj.next_page_number()) if page_obj.has_next() else "",
    }
    return page_obj, pagination, page_notice


def track_list(request):
    tracks = Track.objects.filter(status=Track.STATUS_PUBLISHED)
    page_obj, pagination, page_notice = _paginate_queryset(request, tracks)
    return render(
        request,
        "tracks/list.html",
        {
            "tracks": page_obj.object_list,
            "page_obj": page_obj,
            "pagination": pagination,
            "page_notice": page_notice,
            "page_title": "全部音乐",
        },
    )


def latest_tracks(request):
    tracks = Track.objects.filter(status=Track.STATUS_PUBLISHED).order_by("-created_at")
    page_obj, pagination, page_notice = _paginate_queryset(request, tracks)
    return render(
        request,
        "tracks/list.html",
        {
            "tracks": page_obj.object_list,
            "page_obj": page_obj,
            "pagination": pagination,
            "page_notice": page_notice,
            "page_title": "最新上传",
        },
    )


@login_required
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

        lyrics_file = request.FILES.get("lyrics_file")
        upload_error = (
            validate_upload_file(audio_file, ALLOWED_AUDIO_EXTENSIONS, MAX_AUDIO_SIZE, "音频文件", "audio")
            or validate_upload_file(cover_image, ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_SIZE, "封面图片", "image")
            or validate_upload_file(lyrics_file, ALLOWED_LYRICS_EXTENSIONS, MAX_LYRICS_SIZE, "歌词文件", "lyrics")
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
        if not artist and request.user.is_authenticated:
            profile = getattr(request.user, "profile", None)
            artist = (
                (profile.display_name if profile and profile.display_name else "")
                or request.user.get_full_name()
                or request.user.get_username()
            )
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
            owner=request.user,
            artist=artist,
            description=description,
            cover_theme=request.POST.get("cover_theme", "summer").strip() or "summer",
            audio_file=audio_file,
            cover_image=cover_image,
            duration_ms=duration_ms,
            status=status,
        )

        raw_lyrics = request.POST.get("lyrics_raw_text", "").strip()
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
