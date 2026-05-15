# -*- coding: utf-8 -*-
from pathlib import Path

from django.core.files.base import ContentFile

from tracks.upload_validation import ALLOWED_IMAGE_EXTENSIONS, validate_upload_file


AVATAR_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
AVATAR_MAX_SIZE = 4 * 1024 * 1024
AVATAR_MAX_DIMENSION = 512
AVATAR_JPEG_QUALITY = 82


def validate_avatar_upload(uploaded_file):
    return validate_upload_file(
        uploaded_file,
        AVATAR_ALLOWED_EXTENSIONS,
        AVATAR_MAX_SIZE,
        "头像图片",
        "image",
    )


def process_avatar_upload(uploaded_file):
    if not uploaded_file:
        return None

    try:
        from PIL import Image
    except ImportError:
        uploaded_file.seek(0)
        return uploaded_file

    uploaded_file.seek(0)
    with Image.open(uploaded_file) as image:
        image.load()
        if image.mode not in {"RGB", "L"}:
            background = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode in {"RGBA", "LA"}:
                background.paste(image, mask=image.getchannel("A"))
            else:
                background.paste(image.convert("RGB"))
            image = background
        else:
            image = image.convert("RGB")

        image.thumbnail((AVATAR_MAX_DIMENSION, AVATAR_MAX_DIMENSION), Image.Resampling.LANCZOS)

        from io import BytesIO

        output = BytesIO()
        image.save(output, format="JPEG", quality=AVATAR_JPEG_QUALITY, optimize=True, progressive=True)

    stem = Path(uploaded_file.name).stem or "avatar"
    return ContentFile(output.getvalue(), name=f"{stem}.jpg")
