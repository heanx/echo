# -*- coding: utf-8 -*-
from pathlib import Path


ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".webm"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_LYRICS_EXTENSIONS = {".lrc", ".txt"}

MAX_AUDIO_SIZE = 50 * 1024 * 1024
MAX_IMAGE_SIZE = 8 * 1024 * 1024
MAX_LYRICS_SIZE = 2 * 1024 * 1024


def read_file_signature(uploaded_file, size=64):
    if not uploaded_file:
        return b""
    original_position = uploaded_file.tell()
    try:
        uploaded_file.seek(0)
        return uploaded_file.read(size)
    finally:
        uploaded_file.seek(original_position)


def audio_signature_matches(extension, header):
    if extension == ".mp3":
        return header.startswith(b"ID3") or (len(header) >= 2 and header[0] == 0xFF and header[1] & 0xE0 == 0xE0)
    if extension == ".wav":
        return header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WAVE"
    if extension == ".ogg":
        return header.startswith(b"OggS")
    if extension == ".flac":
        return header.startswith(b"fLaC")
    if extension == ".webm":
        return header.startswith(b"\x1a\x45\xdf\xa3")
    if extension == ".m4a":
        return len(header) >= 12 and header[4:8] == b"ftyp" and header[8:12] in {b"M4A ", b"isom", b"mp41", b"mp42", b"qt  "}
    if extension == ".aac":
        return len(header) >= 2 and header[0] == 0xFF and header[1] & 0xF0 == 0xF0
    return False


def image_signature_matches(extension, header):
    if extension in {".jpg", ".jpeg"}:
        return header.startswith(b"\xff\xd8\xff")
    if extension == ".png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".gif":
        return header.startswith((b"GIF87a", b"GIF89a"))
    if extension == ".webp":
        return header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WEBP"
    return False


def lyrics_signature_matches(extension, header):
    if extension not in ALLOWED_LYRICS_EXTENSIONS or not header:
        return False
    blocked_prefixes = (b"MZ", b"\x7fELF", b"PK\x03\x04", b"\x89PNG", b"\xff\xd8\xff", b"GIF8", b"RIFF")
    return not header.startswith(blocked_prefixes)


def signature_matches(extension, header, kind):
    if kind == "audio":
        return audio_signature_matches(extension, header)
    if kind == "image":
        return image_signature_matches(extension, header)
    if kind == "lyrics":
        return lyrics_signature_matches(extension, header)
    return True


def validate_upload_file(uploaded_file, allowed_extensions, max_size, label, kind):
    if not uploaded_file:
        return ""

    extension = Path(uploaded_file.name).suffix.lower()
    if extension not in allowed_extensions:
        allowed = "、".join(sorted(allowed_extensions))
        return f"{label}格式不支持，请上传 {allowed} 文件"
    if uploaded_file.size <= 0:
        return f"{label}不能为空文件"
    if uploaded_file.size > max_size:
        limit_mb = max_size // (1024 * 1024)
        return f"{label}不能超过 {limit_mb}MB"

    header = read_file_signature(uploaded_file)
    if not signature_matches(extension, header, kind):
        return f"{label}内容与扩展名不匹配，请上传真实的{label}"
    return ""
