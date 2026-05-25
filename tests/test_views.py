import base64
import os
import shutil
import tempfile
from io import BytesIO, StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from albums.models import Album, Playlist, PlaylistFavorite, PlaylistTrack
from comments.models import TrackComment, TrackCommentReaction
from core.models import Notification
from lyrics.models import TrackLyrics
from tracks.models import Track, TrackLike, TrackPlay


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
        self.assertTrue(TrackPlay.objects.filter(track=self.track, session_key=self.client.session.session_key).exists())

    def test_post_play_records_user_recent_track(self):
        user = User.objects.create_user(username="recent-listener", password="a-strong-test-pass-123")
        self.client.force_login(user)
        self.client.post(reverse("tracks:record_play", kwargs={"pk": self.track.pk}))
        play = TrackPlay.objects.get(track=self.track, user=user)
        self.assertEqual(play.play_count, 1)
        self.client.post(reverse("tracks:record_play", kwargs={"pk": self.track.pk}))
        play.refresh_from_db()
        self.assertEqual(play.play_count, 2)

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


class TrackLikeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="track-liker", password="a-strong-test-pass-123")
        self.track = Track.objects.create(title="Likeable", artist="Echo", status=Track.STATUS_PUBLISHED, likes=0)

    def test_like_toggle_updates_relation_and_count(self):
        self.client.force_login(self.user)
        url = reverse("tracks:toggle_like", kwargs={"pk": self.track.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["liked"])
        self.assertEqual(response.json()["liked_track_count_label"], "1")
        self.track.refresh_from_db()
        self.assertEqual(self.track.likes, 1)
        self.assertTrue(TrackLike.objects.filter(track=self.track, user=self.user).exists())

        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["liked"])
        self.assertEqual(response.json()["liked_track_count_label"], "0")
        self.track.refresh_from_db()
        self.assertEqual(self.track.likes, 0)
        self.assertFalse(TrackLike.objects.filter(track=self.track, user=self.user).exists())

    def test_like_requires_login(self):
        response = self.client.post(reverse("tracks:toggle_like", kwargs={"pk": self.track.pk}))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/login/", response["Location"])

    def test_cannot_like_hidden_track(self):
        self.track.status = Track.STATUS_HIDDEN
        self.track.save(update_fields=["status"])
        self.client.force_login(self.user)
        response = self.client.post(reverse("tracks:toggle_like", kwargs={"pk": self.track.pk}))
        self.assertEqual(response.status_code, 404)
        self.assertFalse(TrackLike.objects.filter(track=self.track, user=self.user).exists())

    def test_liked_tracks_page_lists_only_public_likes(self):
        hidden = Track.objects.create(title="Hidden Like", artist="Echo", status=Track.STATUS_HIDDEN)
        self.client.force_login(self.user)
        self.client.post(reverse("tracks:toggle_like", kwargs={"pk": self.track.pk}))
        TrackLike.objects.create(track=hidden, user=self.user)
        liked_playlist = Playlist.objects.get(creator=self.user, playlist_type=Playlist.TYPE_LIKED)

        response = self.client.get(reverse("tracks:liked"), follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertRedirects(
            response,
            reverse("user_playlist_detail", kwargs={"username": self.user.username, "pk": liked_playlist.pk}),
        )
        self.assertContains(response, "Likeable")
        self.assertNotContains(response, "Hidden Like")
        self.assertContains(response, 'data-play-queue="playlist-')

    def test_like_status_reports_current_user_state(self):
        response = self.client.get(reverse("tracks:like_status", kwargs={"pk": self.track.pk}))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["authenticated"])
        self.assertFalse(response.json()["liked"])

        TrackLike.objects.create(track=self.track, user=self.user)
        self.client.force_login(self.user)
        response = self.client.get(reverse("tracks:like_status", kwargs={"pk": self.track.pk}))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["authenticated"])
        self.assertTrue(response.json()["liked"])


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


class CommentInteractionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="commenter", password="a-strong-test-pass-123")
        self.track = Track.objects.create(title="Commentable", artist="Echo", status=Track.STATUS_PUBLISHED)
        self.comment = TrackComment.objects.create(track=self.track, user=self.user, body="First thought")

    def test_reply_creates_child_comment_and_updates_count(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("comments:create", kwargs={"track_id": self.track.pk}),
            {
                "parent": self.comment.pk,
                "reply_to_user_name": self.comment.author,
                "body": "I agree",
            },
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)
        self.comment.refresh_from_db()
        reply = self.comment.child_comments.get()
        self.assertEqual(reply.body, "I agree")
        self.assertEqual(reply.reply_to_user_name, self.comment.author)
        self.assertEqual(self.comment.reply_count, 1)

    def test_like_toggle_updates_reaction_and_count(self):
        self.client.force_login(self.user)
        url = reverse("comments:toggle_like", kwargs={"comment_id": self.comment.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["like_count"], 1)
        self.assertTrue(TrackCommentReaction.objects.filter(comment=self.comment, user=self.user).exists())
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["like_count"], 0)
        self.assertFalse(TrackCommentReaction.objects.filter(comment=self.comment, user=self.user).exists())

    def test_reply_and_like_create_notifications_for_comment_owner(self):
        owner = User.objects.create_user(username="comment-owner", password="a-strong-test-pass-123")
        actor = User.objects.create_user(username="comment-actor", password="a-strong-test-pass-123")
        comment = TrackComment.objects.create(track=self.track, user=owner, body="Original")
        self.client.force_login(actor)
        self.client.post(
            reverse("comments:create", kwargs={"track_id": self.track.pk}),
            {"parent": comment.pk, "reply_to_user_name": comment.author, "body": "Reply"},
        )
        self.client.post(reverse("comments:toggle_like", kwargs={"comment_id": comment.pk}))
        self.assertEqual(Notification.objects.filter(recipient=owner, is_read=False).count(), 2)

    def test_cannot_reply_to_hidden_parent_comment(self):
        hidden_parent = TrackComment.objects.create(
            track=self.track,
            user=self.user,
            body="Hidden",
            status=TrackComment.STATUS_HIDDEN,
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("comments:create", kwargs={"track_id": self.track.pk}),
            {"parent": hidden_parent.pk, "body": "Reply"},
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(TrackComment.objects.filter(parent=hidden_parent).exists())

    def test_cannot_like_comment_when_track_is_hidden(self):
        self.track.status = Track.STATUS_HIDDEN
        self.track.save(update_fields=["status"])
        self.client.force_login(self.user)
        response = self.client.post(reverse("comments:toggle_like", kwargs={"comment_id": self.comment.pk}))
        self.assertEqual(response.status_code, 404)
        self.assertFalse(TrackCommentReaction.objects.filter(comment=self.comment, user=self.user).exists())

    def test_comments_are_paginated(self):
        for index in range(12):
            TrackComment.objects.create(track=self.track, user=self.user, body=f"Comment {index}")

        response = self.client.get(reverse("comments"), {"track": self.track.pk})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["comments"]), 10)
        self.assertEqual(response.context["comment_count"], 13)
        self.assertTrue(response.context["pagination"]["has_other_pages"])

    def test_comment_owner_can_delete_comment(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("comments:delete", kwargs={"comment_id": self.comment.pk}))

        self.assertRedirects(response, f"/comments/?track={self.track.pk}", fetch_redirect_response=False)
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.status, TrackComment.STATUS_DELETED)

    def test_track_owner_can_delete_comment(self):
        owner = User.objects.create_user(username="track-owner", password="a-strong-test-pass-123")
        self.track.owner = owner
        self.track.save(update_fields=["owner"])
        self.client.force_login(owner)

        response = self.client.post(reverse("comments:delete", kwargs={"comment_id": self.comment.pk}))

        self.assertRedirects(response, f"/comments/?track={self.track.pk}", fetch_redirect_response=False)
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.status, TrackComment.STATUS_DELETED)


class NotificationViewTests(TestCase):
    def test_notification_count_and_mark_read(self):
        user = User.objects.create_user(username="notify-user", password="a-strong-test-pass-123")
        notification = Notification.objects.create(
            recipient=user,
            title="有人回复了你",
            body="去看看",
            target_url="/comments/",
        )
        self.client.force_login(user)
        response = self.client.get(reverse("notifications"))
        self.assertContains(response, "有人回复了你")
        self.assertContains(response, "1", html=False)
        response = self.client.post(reverse("notification_read", kwargs={"pk": notification.pk}))
        self.assertRedirects(response, "/comments/", fetch_redirect_response=False)
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)


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


    def test_lyrics_upload_does_not_list_hidden_tracks(self):
        Track.objects.create(title="Visible Track", artist="A", status=Track.STATUS_PUBLISHED)
        Track.objects.create(title="Hidden Track", artist="A", status=Track.STATUS_HIDDEN)
        response = self.client.get(reverse("lyrics:upload"))
        self.assertContains(response, "Visible Track")
        self.assertNotContains(response, "Hidden Track")

    def test_lyrics_upload_rejects_other_users_hidden_track(self):
        owner = User.objects.create_user(username="hidden-owner", password="pass")
        hidden_track = Track.objects.create(title="Private Draft", owner=owner, status=Track.STATUS_HIDDEN)
        response = self.client.post(
            reverse("lyrics:upload"),
            {
                "track": hidden_track.pk,
                "status": TrackLyrics.STATUS_AVAILABLE,
                "raw_text": "private lyric",
            },
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(TrackLyrics.objects.filter(track=hidden_track).exists())

    def test_lyrics_upload_allows_owner_hidden_track(self):
        hidden_track = Track.objects.create(title="Own Draft", owner=self.user, status=Track.STATUS_HIDDEN)
        response = self.client.post(
            reverse("lyrics:upload"),
            {
                "track": hidden_track.pk,
                "status": TrackLyrics.STATUS_AVAILABLE,
                "raw_text": "owner lyric",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(TrackLyrics.objects.filter(track=hidden_track, raw_text="owner lyric").exists())

    def test_lyrics_upload_replaces_invalid_kind_with_default(self):
        track = Track.objects.create(title="Kind Track", artist="A", status=Track.STATUS_PUBLISHED)
        response = self.client.post(
            reverse("lyrics:upload"),
            {
                "track": track.pk,
                "status": TrackLyrics.STATUS_AVAILABLE,
                "kind": "not-a-kind",
                "raw_text": "kind lyric",
            },
        )
        self.assertEqual(response.status_code, 302)
        lyrics = TrackLyrics.objects.get(track=track)
        self.assertEqual(lyrics.kind, TrackLyrics.KIND_ORIGINAL)

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

    def test_register_rejects_duplicate_id(self):
        User.objects.create_user(username="taken-id", password="a-strong-test-pass-123")
        response = self.client.post(
            reverse("register"),
            {
                "username": "taken-id",
                "display_name": "Taken Listener",
                "password1": "a-strong-test-pass-123",
                "password2": "a-strong-test-pass-123",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "这个 ID 已经被使用，请换一个。")
        self.assertEqual(User.objects.filter(username__iexact="taken-id").count(), 1)

    def test_login_uses_next_parameter(self):
        user = User.objects.create_user(username="listener", password="a-strong-test-pass-123")
        response = self.client.post(
            reverse("login") + "?next=/tracks/upload/",
            {"username": user.username, "password": "a-strong-test-pass-123"},
        )
        self.assertRedirects(response, "/tracks/upload/")

    def test_login_rejects_external_next_parameter(self):
        user = User.objects.create_user(username="safe-listener", password="a-strong-test-pass-123")
        response = self.client.post(
            reverse("login") + "?next=https://evil.example/phish",
            {"username": user.username, "password": "a-strong-test-pass-123"},
        )
        self.assertRedirects(response, reverse("home"))

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

    def test_register_accepts_preset_avatar(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "preset-avatar-user",
                "display_name": "Preset Avatar",
                "avatar_preset": "pulse",
                "password1": "preset123",
                "password2": "preset123",
            },
        )
        self.assertEqual(response.status_code, 302)
        user = User.objects.get(username="preset-avatar-user")
        self.assertEqual(user.profile.avatar_preset, "pulse")
        self.assertIn("avatar-presets/pulse.svg", user.profile.avatar_url)

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

    def test_register_explains_nickname_and_id(self):
        response = self.client.get(reverse("register"))
        self.assertContains(response, "昵称")
        self.assertContains(response, "ID")
        self.assertContains(response, "用于登录和个人主页地址")
        self.assertContains(response, "显示在个人主页、评论和上传作品旁")

    def test_account_security_rejects_duplicate_id(self):
        current_user = User.objects.create_user(username="current-id", password="a-strong-test-pass-123")
        User.objects.create_user(username="other-id", password="a-strong-test-pass-123")
        self.client.force_login(current_user)
        response = self.client.post(
            reverse("account_security"),
            {
                "username": "other-id",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "这个 ID 已经被使用，请换一个。")
        current_user.refresh_from_db()
        self.assertEqual(current_user.username, "current-id")

    def test_account_security_can_update_id(self):
        user = User.objects.create_user(username="old-id", password="a-strong-test-pass-123")
        self.client.force_login(user)
        response = self.client.post(
            reverse("account_security"),
            {
                "username": "new-id",
            },
        )
        self.assertRedirects(response, reverse("profile", kwargs={"username": "new-id"}))
        user.refresh_from_db()
        self.assertEqual(user.username, "new-id")

    def test_account_security_can_update_password(self):
        user = User.objects.create_user(username="secure-user", password="old-pass-123")
        self.client.force_login(user)
        response = self.client.post(
            reverse("account_security"),
            {
                "username": "secure-user",
                "current_password": "old-pass-123",
                "new_password1": "new-pass-123",
                "new_password2": "new-pass-123",
            },
        )
        self.assertRedirects(response, reverse("profile", kwargs={"username": "secure-user"}))
        user.refresh_from_db()
        self.assertTrue(user.check_password("new-pass-123"))
        response = self.client.get(reverse("account_security"))
        self.assertEqual(response.status_code, 200)

    def test_account_security_rejects_wrong_current_password(self):
        user = User.objects.create_user(username="wrong-current", password="old-pass-123")
        self.client.force_login(user)
        response = self.client.post(
            reverse("account_security"),
            {
                "username": "wrong-current",
                "current_password": "not-the-password",
                "new_password1": "new-pass-123",
                "new_password2": "new-pass-123",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "当前密码不正确。")
        user.refresh_from_db()
        self.assertTrue(user.check_password("old-pass-123"))

    def test_register_password_requires_minimum_length(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "short-password",
                "display_name": "Short Password",
                "password1": "abc1234",
                "password2": "abc1234",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "密码不能低于 8 位")
        self.assertFalse(User.objects.filter(username="short-password").exists())

    def test_register_password_requires_letter_and_number(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "numberless-password",
                "display_name": "Numberless Password",
                "password1": "abcdefgh",
                "password2": "abcdefgh",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "密码必须包含至少 1 个数字")
        self.assertFalse(User.objects.filter(username="numberless-password").exists())

    def test_register_password_rejects_unsupported_symbol(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "bad-symbol-password",
                "display_name": "Bad Symbol Password",
                "password1": "abc12345~",
                "password2": "abc12345~",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "密码只能使用英文字母、数字和")
        self.assertFalse(User.objects.filter(username="bad-symbol-password").exists())


class UserAvatarRenderingTests(TestCase):
    def setUp(self):
        self.png_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
        )
        self.user = User.objects.create_user(
            username="avatar-render-user",
            password="a-strong-test-pass-123",
        )
        self.user.profile.display_name = "Avatar Render"
        self.user.profile.avatar = SimpleUploadedFile("avatar.png", self.png_bytes, content_type="image/png")
        self.user.profile.save(update_fields=["display_name", "avatar"])

    def test_authenticated_home_renders_account_menu(self):
        self.client.force_login(self.user)
        response = self.client.get("/")
        self.assertContains(response, "data-account-menu-trigger")
        self.assertContains(response, "Echo 设置")

    def test_profile_page_prefers_uploaded_avatar(self):
        response = self.client.get(reverse("profile", kwargs={"username": self.user.username}))
        self.assertContains(response, self.user.profile.avatar.url)

    def test_search_results_show_uploaded_avatar(self):
        response = self.client.get(reverse("search"), {"q": "Avatar Render"})
        self.assertContains(response, self.user.profile.avatar.url)

    def test_profile_page_shows_basic_stats(self):
        Track.objects.create(title="Owned Song", artist="Echo", owner=self.user, status=Track.STATUS_PUBLISHED)
        TrackComment.objects.create(track=Track.objects.create(title="Other Song", artist="Echo", status=Track.STATUS_PUBLISHED), user=self.user, body="Nice")
        response = self.client.get(reverse("profile", kwargs={"username": self.user.username}))
        self.assertContains(response, "加入时间")
        self.assertContains(response, "公开作品")
        self.assertContains(response, "公开评论")


class SearchPaginationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.playlist_owner = User.objects.create_user(username="playlist-search-owner", password="a-strong-test-pass-123")
        for index in range(25):
            Track.objects.create(
                title=f"Searchable Track {index:02d}",
                artist="Search Artist",
                status=Track.STATUS_PUBLISHED,
            )
        Playlist.objects.create(
            title="Searchable Road Mix",
            description="Searchable playlist description",
            creator=cls.playlist_owner,
            visibility=Playlist.VISIBILITY_PUBLIC,
            track_count=3,
        )
        Playlist.objects.create(
            title="Searchable Private Mix",
            creator=cls.playlist_owner,
            visibility=Playlist.VISIBILITY_PRIVATE,
        )

    def test_search_results_are_paginated(self):
        response = self.client.get(reverse("search"), {"q": "Searchable", "type": "tracks"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["tracks"]), 20)
        self.assertEqual(response.context["pagination"]["total_items"], 25)
        self.assertEqual(response.context["active_type"], "tracks")
        self.assertContains(response, 'data-play-queue="search-tracks"')

    def test_search_results_second_page_preserves_query(self):
        response = self.client.get(reverse("search"), {"q": "Searchable", "type": "tracks", "page": 2})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["tracks"]), 5)
        self.assertContains(response, "q=Searchable")

    def test_search_suggest_returns_tracks(self):
        response = self.client.get(reverse("search_suggest"), {"q": "Searchable"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["query"], "Searchable")
        self.assertTrue(payload["suggestions"])
        self.assertTrue(payload["tracks"])
        self.assertIn("audio_url", payload["tracks"][0])

    def test_search_results_include_public_playlists(self):
        response = self.client.get(reverse("search"), {"q": "Searchable", "type": "playlists"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["active_type"], "playlists")
        self.assertEqual(response.context["total_playlists"], 1)
        self.assertContains(response, "Searchable Road Mix")
        self.assertNotContains(response, "Searchable Private Mix")

    def test_search_suggest_returns_playlists(self):
        response = self.client.get(reverse("search_suggest"), {"q": "Road Mix"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["playlists"])
        self.assertEqual(payload["playlists"][0]["title"], "Searchable Road Mix")


class PlaylistCrudTests(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()
        self.user = User.objects.create_user(username="playlist-owner", password="a-strong-test-pass-123")
        self.track = Track.objects.create(title="Playlist Track", artist="Echo", status=Track.STATUS_PUBLISHED)

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def playlist_url(self, name, playlist=None, **kwargs):
        params = {"username": self.user.username, **kwargs}
        if playlist:
            params["pk"] = playlist.pk
        return reverse(name, kwargs=params)

    def test_playlist_create_edit_and_detail(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("user_playlist_create", kwargs={"username": self.user.username}),
            {
                "title": "Road Mix",
                "description": "For late rides",
                "visibility": Playlist.VISIBILITY_PUBLIC,
                "cover_theme": "night",
            },
        )
        playlist = Playlist.objects.get(title="Road Mix")
        self.assertRedirects(response, self.playlist_url("user_playlist_detail", playlist))
        response = self.client.post(
            self.playlist_url("user_playlist_edit", playlist),
            {
                "title": "Road Mix 2",
                "description": "Updated",
                "visibility": Playlist.VISIBILITY_PUBLIC,
                "cover_theme": "forest",
            },
        )
        self.assertRedirects(response, self.playlist_url("user_playlist_detail", playlist))
        playlist.refresh_from_db()
        self.assertEqual(playlist.title, "Road Mix 2")
        response = self.client.get(self.playlist_url("user_playlist_detail", playlist))
        self.assertContains(response, 'data-play-queue="playlist-')

    def test_playlist_add_reorder_and_remove_track(self):
        playlist = Playlist.objects.create(title="Queue", creator=self.user)
        self.client.force_login(self.user)
        response = self.client.post(
            self.playlist_url("user_playlist_add_track", playlist),
            {"track": self.track.pk, "position": 2},
        )
        self.assertRedirects(response, self.playlist_url("user_playlist_detail", playlist))
        item = PlaylistTrack.objects.get(playlist=playlist, track=self.track)
        self.assertEqual(item.position, 2)
        response = self.client.post(
            self.playlist_url("user_playlist_reorder_track", playlist, item_id=item.pk),
            {"position": 0},
        )
        self.assertRedirects(response, self.playlist_url("user_playlist_detail", playlist))
        item.refresh_from_db()
        self.assertEqual(item.position, 0)
        response = self.client.post(
            self.playlist_url("user_playlist_remove_track", playlist, item_id=item.pk)
        )
        self.assertRedirects(response, self.playlist_url("user_playlist_detail", playlist))
        self.assertFalse(PlaylistTrack.objects.filter(pk=item.pk).exists())

    def test_playlist_bulk_manage_removes_selected_tracks(self):
        playlist = Playlist.objects.create(title="Queue", creator=self.user)
        second_track = Track.objects.create(title="Second Track", artist="Echo", status=Track.STATUS_PUBLISHED)
        first_item = PlaylistTrack.objects.create(playlist=playlist, track=self.track, position=0)
        second_item = PlaylistTrack.objects.create(playlist=playlist, track=second_track, position=1)
        self.client.force_login(self.user)

        response = self.client.post(
            self.playlist_url("user_playlist_bulk_manage", playlist),
            {"action": "remove", "selected_items": [first_item.pk]},
        )

        self.assertRedirects(response, self.playlist_url("user_playlist_detail", playlist))
        self.assertFalse(PlaylistTrack.objects.filter(pk=first_item.pk).exists())
        self.assertTrue(PlaylistTrack.objects.filter(pk=second_item.pk).exists())

    def test_playlist_cover_upload_is_saved(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("user_playlist_create", kwargs={"username": self.user.username}),
            {
                "title": "Cover Mix",
                "description": "",
                "visibility": Playlist.VISIBILITY_PUBLIC,
                "cover_theme": "night",
                "cover_image": SimpleUploadedFile(
                    "cover.png",
                    base64.b64decode(
                        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
                    ),
                    content_type="image/png",
                ),
            },
        )

        playlist = Playlist.objects.get(title="Cover Mix")
        self.assertRedirects(response, self.playlist_url("user_playlist_detail", playlist))
        self.assertTrue(playlist.cover_image)

    def test_private_playlist_is_hidden_from_other_users(self):
        other = User.objects.create_user(username="playlist-viewer", password="a-strong-test-pass-123")
        playlist = Playlist.objects.create(title="Private", creator=self.user, visibility=Playlist.VISIBILITY_PRIVATE)
        self.client.force_login(other)
        response = self.client.get(reverse("user_playlist_detail", kwargs={"username": self.user.username, "pk": playlist.pk}))
        self.assertEqual(response.status_code, 404)

    def test_old_albums_playlist_route_is_removed(self):
        response = self.client.get("/albums/playlists/")
        self.assertEqual(response.status_code, 404)

    def test_top_level_playlist_route_is_removed(self):
        playlist = Playlist.objects.create(title="Gone", creator=self.user)
        response = self.client.get(f"/playlists/{playlist.pk}/")
        self.assertEqual(response.status_code, 404)

    def test_user_playlist_center_shows_owner_sections(self):
        Playlist.objects.create(title="Mine", creator=self.user)
        self.client.force_login(self.user)

        response = self.client.get(reverse("user_playlists", kwargs={"username": self.user.username}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "我喜欢的音乐")
        self.assertContains(response, "我的歌单")
        self.assertContains(response, "收藏的歌单")
        self.assertContains(response, "置顶")

    def test_public_playlist_can_be_favorited(self):
        other = User.objects.create_user(username="playlist-maker", password="a-strong-test-pass-123")
        playlist = Playlist.objects.create(title="Public", creator=other, visibility=Playlist.VISIBILITY_PUBLIC)
        self.client.force_login(self.user)

        response = self.client.post(reverse("user_playlist_favorite", kwargs={"username": other.username, "pk": playlist.pk}))

        self.assertRedirects(response, reverse("user_playlist_detail", kwargs={"username": other.username, "pk": playlist.pk}))
        self.assertTrue(PlaylistFavorite.objects.filter(user=self.user, playlist=playlist).exists())


class MediaLifecycleTests(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def test_track_delete_removes_uploaded_files(self):
        track = Track.objects.create(
            title="With Files",
            artist="Echo",
            status=Track.STATUS_PUBLISHED,
            audio_file=SimpleUploadedFile("song.mp3", b"ID3" + b"\x00" * 32, content_type="audio/mpeg"),
            cover_image=SimpleUploadedFile("cover.png", base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
            ), content_type="image/png"),
        )
        audio_path = track.audio_file.path
        cover_path = track.cover_image.path
        self.assertTrue(os.path.exists(audio_path))
        self.assertTrue(os.path.exists(cover_path))
        track.delete()
        self.assertFalse(os.path.exists(audio_path))
        self.assertFalse(os.path.exists(cover_path))

    def test_replacing_track_cover_removes_old_file(self):
        first_png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
        )
        second_png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8AABQMBgAFeK3sAAAAASUVORK5CYII="
        )
        track = Track.objects.create(
            title="Replace Cover",
            status=Track.STATUS_PUBLISHED,
            cover_image=SimpleUploadedFile("cover-a.png", first_png, content_type="image/png"),
        )
        old_path = track.cover_image.path
        self.assertTrue(os.path.exists(old_path))
        track.cover_image = SimpleUploadedFile("cover-b.png", second_png, content_type="image/png")
        track.save()
        self.assertFalse(os.path.exists(old_path))
        self.assertTrue(os.path.exists(track.cover_image.path))

    def test_replacing_lyrics_source_file_removes_old_file(self):
        track = Track.objects.create(title="Lyrics File", status=Track.STATUS_PUBLISHED)
        lyrics = TrackLyrics.objects.create(
            track=track,
            source_file=SimpleUploadedFile("lyrics-a.txt", b"old", content_type="text/plain"),
            raw_text="old",
        )
        old_path = lyrics.source_file.path
        self.assertTrue(os.path.exists(old_path))
        lyrics.source_file = SimpleUploadedFile("lyrics-b.txt", b"new", content_type="text/plain")
        lyrics.save()
        self.assertFalse(os.path.exists(old_path))
        self.assertTrue(os.path.exists(lyrics.source_file.path))

    def test_replacing_album_cover_removes_old_file(self):
        first_png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
        )
        second_png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8AABQMBgAFeK3sAAAAASUVORK5CYII="
        )
        album = Album.objects.create(
            title="Replace Album",
            cover_image=SimpleUploadedFile("album-a.png", first_png, content_type="image/png"),
        )
        old_path = album.cover_image.path
        self.assertTrue(os.path.exists(old_path))
        album.cover_image = SimpleUploadedFile("album-b.png", second_png, content_type="image/png")
        album.save()
        self.assertFalse(os.path.exists(old_path))
        self.assertTrue(os.path.exists(album.cover_image.path))

    def test_replacing_profile_avatar_removes_old_file(self):
        first_png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
        )
        second_png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8AABQMBgAFeK3sAAAAASUVORK5CYII="
        )
        user = User.objects.create_user(username="avatar-replace", password="pass")
        user.profile.avatar = SimpleUploadedFile("avatar-a.png", first_png, content_type="image/png")
        user.profile.save()
        old_path = user.profile.avatar.path
        self.assertTrue(os.path.exists(old_path))
        user.profile.avatar = SimpleUploadedFile("avatar-b.png", second_png, content_type="image/png")
        user.profile.save()
        self.assertFalse(os.path.exists(old_path))
        self.assertTrue(os.path.exists(user.profile.avatar.path))

    def test_cleanup_orphan_media_dry_run_and_delete(self):
        orphan_dir = os.path.join(self.media_root, "tracks", "audio")
        os.makedirs(orphan_dir, exist_ok=True)
        orphan_path = os.path.join(orphan_dir, "orphan.mp3")
        with open(orphan_path, "wb") as handle:
            handle.write(b"orphan")
        output = StringIO()
        call_command("cleanup_orphan_media", stdout=output)
        self.assertIn("orphan.mp3", output.getvalue())
        self.assertTrue(os.path.exists(orphan_path))
        call_command("cleanup_orphan_media", "--delete", stdout=StringIO())
        self.assertFalse(os.path.exists(orphan_path))


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
