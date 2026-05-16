import base64
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from albums.models import Playlist, PlaylistTrack
from comments.models import TrackComment, TrackCommentReaction
from core.models import Notification
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
        for index in range(25):
            Track.objects.create(
                title=f"Searchable Track {index:02d}",
                artist="Search Artist",
                status=Track.STATUS_PUBLISHED,
            )

    def test_search_results_are_paginated(self):
        response = self.client.get(reverse("search"), {"q": "Searchable"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["tracks"]), 20)
        self.assertEqual(response.context["pagination"]["total_items"], 25)
        self.assertContains(response, 'data-play-queue="search-tracks"')

    def test_search_results_second_page_preserves_query(self):
        response = self.client.get(reverse("search"), {"q": "Searchable", "page": 2})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["tracks"]), 5)
        self.assertContains(response, "q=Searchable")


class PlaylistCrudTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="playlist-owner", password="a-strong-test-pass-123")
        self.track = Track.objects.create(title="Playlist Track", artist="Echo", status=Track.STATUS_PUBLISHED)

    def test_playlist_create_edit_and_detail(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("albums:playlist_create"),
            {
                "title": "Road Mix",
                "description": "For late rides",
                "is_public": "on",
                "cover_theme": "night",
            },
        )
        playlist = Playlist.objects.get(title="Road Mix")
        self.assertRedirects(response, reverse("albums:playlist_detail", kwargs={"pk": playlist.pk}))
        response = self.client.post(
            reverse("albums:playlist_edit", kwargs={"pk": playlist.pk}),
            {
                "title": "Road Mix 2",
                "description": "Updated",
                "is_public": "on",
                "cover_theme": "forest",
            },
        )
        self.assertRedirects(response, reverse("albums:playlist_detail", kwargs={"pk": playlist.pk}))
        playlist.refresh_from_db()
        self.assertEqual(playlist.title, "Road Mix 2")
        response = self.client.get(reverse("albums:playlist_detail", kwargs={"pk": playlist.pk}))
        self.assertContains(response, 'data-play-queue="playlist-')

    def test_playlist_add_reorder_and_remove_track(self):
        playlist = Playlist.objects.create(title="Queue", owner=self.user)
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("albums:playlist_add_track", kwargs={"pk": playlist.pk}),
            {"track": self.track.pk, "position": 2},
        )
        self.assertRedirects(response, reverse("albums:playlist_detail", kwargs={"pk": playlist.pk}))
        item = PlaylistTrack.objects.get(playlist=playlist, track=self.track)
        self.assertEqual(item.position, 2)
        response = self.client.post(
            reverse("albums:playlist_reorder_track", kwargs={"pk": playlist.pk, "item_id": item.pk}),
            {"position": 0},
        )
        self.assertRedirects(response, reverse("albums:playlist_detail", kwargs={"pk": playlist.pk}))
        item.refresh_from_db()
        self.assertEqual(item.position, 0)
        response = self.client.post(
            reverse("albums:playlist_remove_track", kwargs={"pk": playlist.pk, "item_id": item.pk})
        )
        self.assertRedirects(response, reverse("albums:playlist_detail", kwargs={"pk": playlist.pk}))
        self.assertFalse(PlaylistTrack.objects.filter(pk=item.pk).exists())

    def test_private_playlist_is_hidden_from_other_users(self):
        other = User.objects.create_user(username="playlist-viewer", password="a-strong-test-pass-123")
        playlist = Playlist.objects.create(title="Private", owner=self.user, is_public=False)
        self.client.force_login(other)
        response = self.client.get(reverse("albums:playlist_detail", kwargs={"pk": playlist.pk}))
        self.assertEqual(response.status_code, 404)


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
