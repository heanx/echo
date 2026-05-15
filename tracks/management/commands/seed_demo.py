# -*- coding: utf-8 -*-
from django.core.management.base import BaseCommand

from albums.models import Album, AlbumTrack
from comments.models import TrackComment
from lyrics.models import TrackLyrics
from tracks.models import Track


class Command(BaseCommand):
    help = "Create demo tracks, albums, comments, and lyrics for Echo."

    def handle(self, *args, **options):
        track_specs = [
            ("夏夜晚风", "Eric 周兴", "summer", 128, 1200, 146000),
            ("城市旅人", "柴郡 Cheshire", "city", 97, 836, 132000),
            ("Eclipse", "Luna Chant", "eclipse", 64, 642, 158000),
            ("回声与海", "海边的卡夫卡", "sea", 82, 950, 171000),
            ("山间信号", "低空飞行", "signal", 43, 410, 125000),
            ("落日留声", "VHS Boy", "sunset", 75, 760, 149000),
            ("Forest Tape", "Green Room", "forest", 52, 530, 138000),
            ("Ocean Loop", "Echo Radio", "ocean", 110, 1600, 184000),
        ]
        album_specs = [
            ("远岸电台", "Echo Radio", "sea", "海风、慢速鼓点和漂浮的人声采样。", ["回声与海", "Ocean Loop", "夏夜晚风"]),
            ("霓虹散步", "Night Runner", "eclipse", "适合夜间通勤的轻电子合集。", ["城市旅人", "Eclipse", "落日留声"]),
            ("晨间信号", "低空飞行", "signal", "清醒、轻快、带一点绿色噪声。", ["山间信号", "Forest Tape", "夏夜晚风"]),
            ("落日留声", "VHS Boy", "sunset", "复古合成器与暖色吉他。", ["落日留声", "城市旅人", "Ocean Loop"]),
            ("城市旅人", "柴郡 Cheshire", "city", "地铁、雨声和凌晨的路灯。", ["城市旅人", "回声与海", "Eclipse"]),
        ]

        tracks_by_title = {}
        for title, artist, theme, likes, plays, duration_ms in track_specs:
            track, _ = Track.objects.update_or_create(
                title=title,
                defaults={
                    "artist": artist,
                    "cover_theme": theme,
                    "description": f"{title} 是一首用于 Echo 前端展示的测试音频。",
                    "duration_ms": duration_ms,
                    "status": Track.STATUS_PUBLISHED,
                    "likes": likes,
                    "plays": plays,
                },
            )
            tracks_by_title[title] = track

        albums_by_title = {}
        for title, creator, theme, description, track_titles in album_specs:
            album, _ = Album.objects.update_or_create(
                title=title,
                defaults={
                    "creator": creator,
                    "cover_theme": theme,
                    "description": description,
                },
            )
            albums_by_title[title] = album
            for position, track_title in enumerate(track_titles, start=1):
                AlbumTrack.objects.update_or_create(
                    album=album,
                    track=tracks_by_title[track_title],
                    defaults={"position": position},
                )

        first_track = tracks_by_title["夏夜晚风"]
        comment_specs = [
            {
                "author_name": "Echo Radio",
                "body": "欢迎把你听到的画面感写下来。我们会把高质量评论整理到作品详情里。",
                "is_pinned": True,
                "like_count": 128,
                "replies": [
                    ("Eric 周兴", "我会把大家提到的画面感留给下一版视觉稿。", True),
                    ("阿沅", "这个置顶很适合当评论区开场。", False),
                ],
            },
            {
                "author_name": "阿沅",
                "body": "副歌进来的时候像突然从地铁口走到雨后的街面，空气一下子亮了。",
                "like_count": 42,
                "timestamp_ms": 41000,
                "replies": [
                    ("Low Tide", "这个比喻太准了，尤其是 00:41 那一下。", False),
                ],
            },
            {
                "author_name": "Low Tide",
                "body": "这个混响尾巴很舒服，适合夜里写东西。想知道人声采样来自哪里？",
                "is_question": True,
                "like_count": 31,
                "timestamp_ms": 58000,
                "replies": [
                    ("Eric 周兴", "采样是自己录的楼道环境声，再做了切片和降噪。", True),
                ],
            },
            {
                "author_name": "林间漫步",
                "body": "鼓组没有压得太满，留白刚好。建议下一版可以把 bridge 的贝斯线再往前一点。",
                "like_count": 19,
                "timestamp_ms": 115000,
                "replies": [],
            },
        ]

        for spec in comment_specs:
            comment, _ = TrackComment.objects.update_or_create(
                track=first_track,
                parent=None,
                author_name=spec["author_name"],
                body=spec["body"],
                defaults={
                    "timestamp_ms": spec.get("timestamp_ms"),
                    "is_pinned": spec.get("is_pinned", False),
                    "is_question": spec.get("is_question", False),
                    "like_count": spec.get("like_count", 0),
                    "reply_count": 0,
                },
            )
            for author_name, body, is_creator_reply in spec["replies"]:
                TrackComment.objects.update_or_create(
                    track=first_track,
                    parent=comment,
                    author_name=author_name,
                    body=body,
                    defaults={
                        "is_creator_reply": is_creator_reply,
                        "reply_to_user_name": comment.author,
                    },
                )
            reply_count = TrackComment.objects.filter(parent=comment).count()
            TrackComment.objects.filter(pk=comment.pk).update(reply_count=reply_count)

        raw_lyrics_by_track = {
            "夏夜晚风": [
                "[00:12.00] 我在回声里听见一束光",
                "[00:26.00] 它穿过城市的雾和夜航",
                "[00:41.00] 当鼓点落下，心跳也跟上",
                "[00:58.00] 把未说出口的话轻轻播放",
                "[01:15.00] If they ask why the sky is blue",
                "[01:31.00] I will say it borrowed its color from you",
                "[01:48.00] 让旋律把沉默慢慢照亮",
                "[02:06.00] 直到我们都成为自己的方向",
            ],
            "回声与海": [
                "[00:08.00] 海面收起最后一封来信",
                "[00:24.00] 回声在远岸慢慢靠近",
                "[00:43.00] 我把潮汐藏进耳机",
                "[01:02.00] 等你听见同一片星云",
            ],
            "城市旅人": [
                "[00:10.00] 雨声贴着车窗滑行",
                "[00:29.00] 霓虹把夜晚剪成倒影",
                "[00:52.00] 下一站没有名字",
                "[01:18.00] 但有人把灯留给清醒",
            ],
        }

        for title, lines in raw_lyrics_by_track.items():
            lyrics, _ = TrackLyrics.objects.update_or_create(
                track=tracks_by_title[title],
                language="zh-Hans",
                kind=TrackLyrics.KIND_ORIGINAL,
                defaults={
                    "raw_text": "\n".join(lines),
                    "parser_version": "simple-lrc-v1",
                    "is_primary": True,
                },
            )
            lyrics.parse_raw_text()

        self.stdout.write(
            self.style.SUCCESS(
                "Demo data created: 8 tracks, 5 albums, album links, comments, replies, and lyrics."
            )
        )
