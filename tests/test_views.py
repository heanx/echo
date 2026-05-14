import base64
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from lyrics.models import TrackLyrics
from tracks.models import Track


User = get_user_model()


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
        self.client.force_login(User.objects.create_user(username="uploader", password="pass"))
        response = self.client.get("/tracks/upload/")
        self.assertEqual(response.status_code, 200)

    def test_lyrics_upload_returns_200(self):
        self.client.force_login(User.objects.create_user(username="lyricist", password="pass"))
        response = self.client.get("/lyrics/upload/")
        self.assertEqual(response.status_code, 200)

    def test_upload_requires_login(self):
        response = self.client.get("/tracks/upload/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/login/", response["Location"])


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
    def setUp(self):
        self.client.force_login(User.objects.create_user(username="format-user", password="pass"))

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


class TrackListPaginationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for index in range(25):
            Track.objects.create(
                title=f"Track {index:02d}",
                artist="Artist",
                status=Track.STATUS_PUBLISHED,
            )

    def test_track_list_paginated_by_default(self):
        response = self.client.get("/tracks/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["tracks"]), 20)
        self.assertEqual(response.context["pagination"]["total_pages"], 2)

    def test_track_list_accepts_page_and_per(self):
        response = self.client.get("/tracks/?page=2&per=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["tracks"]), 10)
        self.assertContains(response, "第 2 / 3 页")

    def test_track_list_out_of_range_page_falls_back_to_last_page(self):
        response = self.client.get("/tracks/?page=99")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["page_obj"].number, 2)
        self.assertContains(response, "请求的页码超出范围")


class UploadSecurityValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="upload-security", password="pass")
        self.client.force_login(self.user)

    def test_rejects_executable_renamed_as_mp3(self):
        response = self.client.post(
            reverse("tracks:upload"),
            {
                "title": "Bad File",
                "audio_file": SimpleUploadedFile("bad.mp3", b"MZfake-executable", content_type="audio/mpeg"),
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "音频文件")
        self.assertEqual(Track.objects.count(), 0)

    def test_rejects_fake_cover_image(self):
        audio_file = SimpleUploadedFile("ok.mp3", b"ID3" + b"\x00" * 32, content_type="audio/mpeg")
        cover_file = SimpleUploadedFile("cover.png", b"MZnot-a-real-image", content_type="image/png")
        response = self.client.post(
            reverse("tracks:upload"),
            {
                "title": "Track With Bad Cover",
                "audio_file": audio_file,
                "cover_image": cover_file,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "封面图片")
        self.assertEqual(Track.objects.count(), 0)

    def test_rejects_binary_lyrics_upload(self):
        track = Track.objects.create(title="T", artist="A", status=Track.STATUS_PUBLISHED)
        response = self.client.post(
            reverse("lyrics:upload"),
            {
                "track": track.pk,
                "status": TrackLyrics.STATUS_AVAILABLE,
                "source_file": SimpleUploadedFile("bad.txt", b"\x89PNG\r\n\x1a\nnot-text", content_type="text/plain"),
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "歌词文件")


    def test_uploaded_track_is_owned_by_current_user(self):
        audio_file = SimpleUploadedFile("ok.mp3", b"ID3" + b"\x00" * 32, content_type="audio/mpeg")
        response = self.client.post(
            reverse("tracks:upload"),
            {
                "title": "Owned Track",
                "artist": "",
                "audio_file": audio_file,
            },
        )
        self.assertEqual(response.status_code, 302)
        track = Track.objects.get(title="Owned Track")
        self.assertEqual(track.owner, self.user)


class AuthFlowTests(TestCase):
    def test_register_creates_user_profile_and_logs_in(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "new-listener",
                "display_name": "New Listener",
                "email": "new@example.com",
                "password1": "a-strong-test-pass-123",
                "password2": "a-strong-test-pass-123",
            },
        )
        self.assertEqual(response.status_code, 302)
        user = User.objects.get(username="new-listener")
        self.assertEqual(user.profile.display_name, "New Listener")
        self.assertIn("_auth_user_id", self.client.session)

    def test_login_uses_next_parameter(self):
        user = User.objects.create_user(username="listener", password="a-strong-test-pass-123")
        response = self.client.post(
            reverse("login") + "?next=/tracks/upload/",
            {"username": user.username, "password": "a-strong-test-pass-123"},
        )
        self.assertRedirects(response, "/tracks/upload/")

    def test_login_without_remember_me_expires_at_browser_close(self):
        user = User.objects.create_user(username="session-listener", password="a-strong-test-pass-123")
        self.client.post(
            reverse("login"),
            {"username": user.username, "password": "a-strong-test-pass-123"},
        )
        self.assertTrue(self.client.session.get_expire_at_browser_close())

    def test_login_with_remember_me_sets_persistent_session(self):
        user = User.objects.create_user(username="remember-listener", password="a-strong-test-pass-123")
        self.client.post(
            reverse("login"),
            {"username": user.username, "password": "a-strong-test-pass-123", "remember_me": "on"},
        )
        self.assertFalse(self.client.session.get_expire_at_browser_close())
        self.assertGreaterEqual(self.client.session.get_expiry_age(), 60 * 60 * 24 * 29)

    def test_register_accepts_valid_avatar_file(self):
        png_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
        )
        response = self.client.post(
            reverse("register"),
            {
                "username": "avatar-user",
                "display_name": "Avatar User",
                "email": "avatar@example.com",
                "password1": "a-strong-test-pass-123",
                "password2": "a-strong-test-pass-123",
                "avatar": SimpleUploadedFile("avatar.png", png_bytes, content_type="image/png"),
            },
        )
        self.assertEqual(response.status_code, 302)
        user = User.objects.get(username="avatar-user")
        self.assertTrue(user.profile.avatar.name)

    def test_register_rejects_fake_avatar_file(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "fake-avatar-user",
                "display_name": "Fake Avatar",
                "email": "fake-avatar@example.com",
                "password1": "a-strong-test-pass-123",
                "password2": "a-strong-test-pass-123",
                "avatar": SimpleUploadedFile("avatar.png", b"MZnot-an-image", content_type="image/png"),
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(username="fake-avatar-user").exists())

    def test_register_avatar_input_accepts_only_images(self):
        response = self.client.get(reverse("register"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'accept="image/jpeg,image/png,image/webp"')


@override_settings(DEBUG=False)
class ErrorPageTests(TestCase):
    def test_custom_404_page_is_rendered(self):
        response = self.client.get("/missing-page/")
        self.assertEqual(response.status_code, 404)
        self.assertContains(response, "页面不存在", status_code=404)

    @override_settings(ROOT_URLCONF="tests.test_error_urls")
    def test_custom_500_page_is_rendered(self):
        self.client.raise_request_exception = False
        response = self.client.get("/boom/")
        self.assertEqual(response.status_code, 500)
        self.assertContains(response, "服务暂时不可用", status_code=500)
