from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from albums.models import Album
from core.models import UserProfile
from lyrics.models import TrackLyrics
from tracks.models import Track


class Command(BaseCommand):
    help = "Find or delete media files that are no longer referenced by database rows."

    def add_arguments(self, parser):
        parser.add_argument("--delete", action="store_true", help="Actually delete orphan files. Defaults to dry-run.")

    def handle(self, *args, **options):
        media_root = Path(settings.MEDIA_ROOT)
        if not media_root.exists():
            self.stdout.write(self.style.WARNING(f"MEDIA_ROOT does not exist: {media_root}"))
            return

        referenced = self._referenced_paths(media_root)
        candidates = self._candidate_files(media_root)
        orphans = sorted(path for path in candidates if path not in referenced)

        if not orphans:
            self.stdout.write(self.style.SUCCESS("No orphan media files found."))
            return

        for path in orphans:
            self.stdout.write(str(path.relative_to(media_root)))
            if options["delete"]:
                path.unlink(missing_ok=True)

        action = "Deleted" if options["delete"] else "Found"
        self.stdout.write(self.style.SUCCESS(f"{action} {len(orphans)} orphan media file(s)."))

    def _referenced_paths(self, media_root):
        names = set()
        names.update(Track.objects.exclude(audio_file="").values_list("audio_file", flat=True))
        names.update(Track.objects.exclude(cover_image="").values_list("cover_image", flat=True))
        names.update(TrackLyrics.objects.exclude(source_file="").values_list("source_file", flat=True))
        names.update(Album.objects.exclude(cover_image="").values_list("cover_image", flat=True))
        names.update(UserProfile.objects.exclude(avatar="").values_list("avatar", flat=True))
        return {media_root / name for name in names if name}

    def _candidate_files(self, media_root):
        roots = [
            media_root / "tracks" / "audio",
            media_root / "tracks" / "covers",
            media_root / "tracks" / "lyrics",
            media_root / "albums" / "covers",
            media_root / "users" / "avatars",
        ]
        files = set()
        for root in roots:
            if root.exists():
                files.update(path for path in root.rglob("*") if path.is_file())
        return files
