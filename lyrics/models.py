import re

from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver

from core.file_cleanup import delete_filefield_file


class TrackLyrics(models.Model):
    STATUS_AVAILABLE = "available"
    STATUS_INSTRUMENTAL = "instrumental"
    STATUS_PENDING = "pending"
    STATUS_CHOICES = [
        (STATUS_AVAILABLE, "有歌词"),
        (STATUS_INSTRUMENTAL, "无歌词的纯音乐"),
        (STATUS_PENDING, "暂无歌词"),
    ]

    KIND_ORIGINAL = "original"
    KIND_TRANSLATION = "translation"
    KIND_ROMANIZED = "romanized"
    KIND_WORD_BY_WORD = "word_by_word"
    KIND_CHOICES = [
        (KIND_ORIGINAL, "原文"),
        (KIND_TRANSLATION, "翻译"),
        (KIND_ROMANIZED, "罗马音"),
        (KIND_WORD_BY_WORD, "逐词"),
    ]

    track = models.ForeignKey("tracks.Track", on_delete=models.CASCADE, related_name="lyrics_sets")
    language = models.CharField(max_length=20, default="zh-Hans")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_ORIGINAL)
    source_file = models.FileField(upload_to="tracks/lyrics/", blank=True, null=True)
    raw_text = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_AVAILABLE)
    parser_version = models.CharField(max_length=40, blank=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_primary", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["track", "language", "kind"], name="unique_track_lyrics_variant")
        ]
        indexes = [
            models.Index(fields=["track", "is_primary", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.track} {self.language} {self.kind}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_primary:
            TrackLyrics.objects.filter(track_id=self.track_id, is_primary=True).exclude(pk=self.pk).update(is_primary=False)

    def parse_raw_text(self):
        self.lines.all().delete()
        if self.status != self.STATUS_AVAILABLE:
            return
        for position, (start_ms, text) in enumerate(parse_lrc_or_text(self.raw_text), start=1):
            TrackLyricLine.objects.create(lyrics=self, start_ms=start_ms, text=text, position=position)


class TrackLyricLine(models.Model):
    lyrics = models.ForeignKey(TrackLyrics, on_delete=models.CASCADE, related_name="lines")
    start_ms = models.PositiveIntegerField(default=0)
    end_ms = models.PositiveIntegerField(null=True, blank=True)
    text = models.TextField()
    translation = models.TextField(blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "start_ms"]
        indexes = [
            models.Index(fields=["lyrics", "start_ms"]),
            models.Index(fields=["lyrics", "position"]),
        ]

    def __str__(self):
        return self.text[:40]

    @property
    def time(self):
        minutes = self.start_ms // 60000
        seconds = (self.start_ms % 60000) // 1000
        return f"{minutes:02d}:{seconds:02d}"


LRC_PATTERN = re.compile(r"^\[(?P<minute>\d{1,2}):(?P<second>\d{2})(?:\.(?P<fraction>\d{1,3}))?\]\s*(?P<text>.*)$")


def parse_lrc_or_text(raw_text):
    rows = []
    for index, raw_line in enumerate(raw_text.splitlines()):
        line = raw_line.strip()
        if not line:
            continue

        match = LRC_PATTERN.match(line)
        if match:
            fraction = (match.group("fraction") or "0").ljust(3, "0")[:3]
            start_ms = (int(match.group("minute")) * 60 + int(match.group("second"))) * 1000 + int(fraction)
            rows.append((start_ms, match.group("text").strip()))
        else:
            rows.append((index * 5000, line))
    return rows


@receiver(post_delete, sender=TrackLyrics)
def delete_lyrics_source_file(sender, instance, **kwargs):
    delete_filefield_file(instance, "source_file")
