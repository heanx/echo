from io import BytesIO

from django.test import TestCase, override_settings
from django.urls import reverse

from tracks.models import Track


class PageStatusTests(TestCase):
    def test_home_returns_200(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)

    def test_lyrics_returns_200(self):
        response = self.client.get("/lyrics/")
        self.assertEqual(response.status_code, 200)

    def test_comments_returns_200(self):
        response = self.client.get("/comments/")
        self.assertEqual(response.status_code, 200)

    def test_track_list_returns_200(self):
        response = self.client.get("/tracks/")
        self.assertEqual(response.status_code, 200)

    def test_latest_tracks_returns_200(self):
        response = self.client.get("/tracks/latest/")
        self.assertEqual(response.status_code, 200)

    def test_track_upload_returns_200(self):
        response = self.client.get("/tracks/upload/")
        self.assertEqual(response.status_code, 200)

    def test_lyrics_upload_returns_200(self):
        response = self.client.get("/lyrics/upload/")
        self.assertEqual(response.status_code, 200)


class RecordPlayTests(TestCase):
    def setUp(self):
        self.track = Track.objects.create(
            title="Test Track",
            artist="Test Artist",
            status=Track.STATUS_PUBLISHED,
            plays=0,
        )

    def test_post_play_increments_plays(self):
        url = reverse("tracks:record_play", kwargs={"pk": self.track.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ok"])
        self.track.refresh_from_db()
        self.assertEqual(self.track.plays, 1)

    def test_post_play_increments_twice(self):
        url = reverse("tracks:record_play", kwargs={"pk": self.track.pk})
        self.client.post(url)
        self.client.post(url)
        self.track.refresh_from_db()
        self.assertEqual(self.track.plays, 2)

    def test_post_play_nonexistent_returns_404(self):
        url = reverse("tracks:record_play", kwargs={"pk": 99999})
        response = self.client.post(url)
        self.assertEqual(response.status_code, 404)


class CommentsNoCacheTests(TestCase):
    def test_comments_no_cache_headers(self):
        response = self.client.get("/comments/")
        self.assertIn("no-cache", response["Cache-Control"])
        self.assertIn("no-store", response["Cache-Control"])
        self.assertIn("must-revalidate", response["Cache-Control"])

    def test_comments_with_track_no_cache_headers(self):
        track = Track.objects.create(
            title="T", artist="A", status=Track.STATUS_PUBLISHED
        )
        response = self.client.get(f"/comments/?track={track.pk}")
        self.assertIn("no-cache", response["Cache-Control"])


class LyricsTrackResolutionTests(TestCase):
    def setUp(self):
        self.track_a = Track.objects.create(
            title="Track A", artist="A", status=Track.STATUS_PUBLISHED
        )
        self.track_b = Track.objects.create(
            title="Track B", artist="B", status=Track.STATUS_PUBLISHED
        )

    def test_lyrics_reads_specified_track(self):
        response = self.client.get(f"/lyrics/?track={self.track_b.pk}")
        self.assertContains(response, "Track B")

    def test_lyrics_specific_track_title_in_heading(self):
        response = self.client.get(f"/lyrics/?track={self.track_a.pk}")
        self.assertContains(response, '<h1 class="mt-2 truncate text-3xl font-black">Track A</h1>')

    def test_lyrics_without_track_falls_back(self):
        response = self.client.get("/lyrics/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-echo-resource="lyrics"')


class UploadFormatHintTests(TestCase):
    def test_upload_page_lists_normal_audio_formats(self):
        response = self.client.get("/tracks/upload/")
        self.assertContains(response, "MP3")
        self.assertContains(response, "WAV")
        self.assertContains(response, "FLAC")

    def test_upload_page_excludes_ncm(self):
        response = self.client.get("/tracks/upload/")
        self.assertNotContains(response, ".ncm")
        self.assertNotContains(response, "ncm")

    def test_lyrics_upload_page_lists_supported_formats(self):
        response = self.client.get("/lyrics/upload/")
        self.assertContains(response, ".lrc")
        self.assertContains(response, ".txt")
