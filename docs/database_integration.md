# Echo 数据库对接说明

更新时间：2026-05-11

## 1. 当前数据库定位

Echo 当前使用 Django ORM + SQLite3。SQLite 适合现阶段本地开发和演示，但评论、播放量、点赞这类计数字段会带来写入竞争，所以项目启动时已经为 SQLite 连接开启：

- `PRAGMA journal_mode=WAL;`
- `PRAGMA synchronous=NORMAL;`
- `PRAGMA busy_timeout=5000;`

入口文件：

```text
core/db.py
core/apps.py
```

后续如果迁移到 PostgreSQL，业务模型可以保留，主要替换数据库配置和少量并发策略。

## 2. 核心实体关系

```text
Track 1 - N TrackComment
TrackComment 1 - N TrackComment
TrackComment 1 - N TrackCommentReaction

Track 1 - N TrackLyrics
TrackLyrics 1 - N TrackLyricLine

Album N - N Track
AlbumTrack 作为中间表保存排序
```

主要 app：

```text
tracks      音频作品
albums      专辑、合集、歌单容器
comments    评论与评论互动
lyrics      歌词版本与歌词行
core        首页、评论页、歌词页聚合查询
```

## 3. Track 音频作品

模型：`tracks.models.Track`

关键字段：

```text
title
artist
description
audio_file
cover_image
cover_theme
duration_ms
status
likes
plays
created_at
updated_at
```

`status` 可选值：

```text
draft
published
hidden
deleted
```

页面读取默认只展示 `published`：

```python
Track.objects.filter(status=Track.STATUS_PUBLISHED)
```

计数字段更新必须使用 `F()` 表达式：

```python
from django.db.models import F

Track.objects.filter(pk=track_id).update(plays=F("plays") + 1)
```

不要先取对象再 `track.plays += 1; track.save()`，这样并发下容易覆盖其他请求的写入。

## 4. Album 与 AlbumTrack

模型：

```text
albums.models.Album
albums.models.AlbumTrack
```

`AlbumTrack` 字段：

```text
album
track
position
added_at
```

约束：

```text
unique_album_track(album, track)
```

含义：同一个专辑下同一首歌只能出现一次。除非未来产品明确做“播放队列”式重复曲目，否则保持这个约束。

常用写法：

```python
AlbumTrack.objects.update_or_create(
    album=album,
    track=track,
    defaults={"position": 1},
)
```

读取专辑曲目：

```python
album.album_tracks.select_related("track").order_by("position", "added_at")
```

## 5. Comments 评论

模型：

```text
comments.models.TrackComment
comments.models.TrackCommentReaction
```

`TrackComment` 字段：

```text
track
user
parent
reply_to_user_name
author_name
body
timestamp_ms
status
is_pinned
is_question
is_creator_reply
like_count
reply_count
report_count
created_at
updated_at
```

评论状态：

```text
published
pending
hidden
deleted
```

评论层级策略：

- 数据库层允许 `parent` 自关联。
- 业务层强制降维为两级结构。
- 如果用户回复的是二级评论，保存时会自动把 `parent` 改成一级评论，并把被回复者放进 `reply_to_user_name`。

这样可以避免无限评论树带来的递归查询和 N+1 风险。

常用查询：

```python
comments = (
    TrackComment.objects
    .for_track(track)
    .visible()
    .top_level()
    .sorted("hot")
)
```

排序规则在 `TrackCommentQuerySet.sorted()`：

```text
hot        置顶 -> like_count -> reply_count -> created_at
new        置顶 -> created_at
questions 只看 is_question=True
```

回复计数更新必须使用 `F()`：

```python
TrackComment.objects.filter(pk=parent_id).update(reply_count=F("reply_count") + 1)
```

`TrackCommentReaction` 用于记录用户是否点过赞：

```text
comment
user
reaction
created_at
```

唯一约束：

```text
unique_comment_user_reaction(comment, user, reaction)
```

## 6. Lyrics 歌词

模型：

```text
lyrics.models.TrackLyrics
lyrics.models.TrackLyricLine
```

`TrackLyrics` 字段：

```text
track
language
kind
source_file
raw_text
parser_version
is_primary
created_at
updated_at
```

`kind` 可选值：

```text
original
translation
romanized
word_by_word
```

约束：

```text
unique_track_lyrics_variant(track, language, kind)
```

业务保护：

- 保存 `is_primary=True` 的歌词后，同一首歌其他歌词版本会自动变成 `is_primary=False`。
- SQLite 下没有使用条件唯一索引，现阶段用模型逻辑保证“同一首歌只有一个 primary”。

`TrackLyricLine` 字段：

```text
lyrics
start_ms
end_ms
text
translation
position
```

`end_ms` 允许为空，不作为前端高亮的强依赖。前端用 `start_ms` 加二分查找即可完成当前歌词行定位。

解析入口：

```python
lyrics.parse_raw_text()
```

当前支持：

```text
[mm:ss.xx] lyric text
纯文本逐行解析
```

纯文本没有时间戳时，会按行号生成 5 秒间隔的占位时间。

## 7. 页面对接

首页：

```text
core.views.home
```

使用：

```text
hero_track
recommended_tracks
latest_tracks
hot_albums
```

评论页：

```text
/comments/?track=<track_id>&sort=hot
/comments/?track=<track_id>&sort=new
/comments/?track=<track_id>&filter=questions
```

视图：

```text
core.views.comments
```

提交：

```text
POST /comments/<track_id>/create/
```

字段：

```text
body
author_name
parent
reply_to_user_name
timestamp_ms
```

歌词页：

```text
/lyrics/?track=<track_id>
```

视图：

```text
core.views.lyrics
```

上传：

```text
/lyrics/upload/?track=<track_id>
```

字段：

```text
track
language
kind
raw_text
source_file
```

## 8. 演示数据

命令：

```powershell
.\.venv\Scripts\python.exe manage.py seed_demo
```

会创建或更新：

- 8 首 Track
- 5 个 Album
- AlbumTrack 专辑曲目关系
- 第一首歌的评论、回复、问题评论、置顶评论
- 3 首歌的 primary LRC 歌词和歌词行

`seed_demo` 使用 `update_or_create`，可以重复执行。

## 9. 验证命令

迁移：

```powershell
.\.venv\Scripts\python.exe manage.py makemigrations
.\.venv\Scripts\python.exe manage.py migrate
```

系统检查：

```powershell
.\.venv\Scripts\python.exe manage.py check
```

页面烟测：

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from django.test import Client; c=Client(); paths=['/','/lyrics/','/comments/','/tracks/','/albums/','/lyrics/upload/']; [print(path, c.get(path, HTTP_HOST='127.0.0.1').status_code) for path in paths]"
```

SQLite WAL 检查：

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from django.db import connection; c=connection.cursor(); print(c.execute('PRAGMA journal_mode;').fetchone()[0]); print(c.execute('PRAGMA busy_timeout;').fetchone()[0])"
```

预期：

```text
wal
5000
```

## 10. 后续建议

- 播放量上报接口已完成，后续需要补真实播放历史和播放队列模型。
- 给评论点赞增加接口，先写 `TrackCommentReaction`，再用 `F()` 更新 `like_count`。
- 评论列表预取一级回复时用 `Prefetch`，不要在模板里逐条查。
- 歌词高亮已经由前端基于 `start_ms` 做当前行定位，后续歌词行较多时可优化为二分查找。
- 真实用户系统落地后，需要把上传、评论、点赞、播放历史绑定到 `auth.User` 或扩展 Profile。
- 搜索系统落地时优先使用 ORM `icontains` 完成课程阶段功能，后续再考虑全文索引。
- 如果进入真实多人使用阶段，优先迁移 PostgreSQL，再考虑任务队列聚合播放量。

## 11. 评论动态刷新约定

评论页必须按请求实时读取数据库，不复用旧 HTML 或进程内缓存。

当前实现入口：

```text
comments.queries.resolve_comment_track(request)
comments.queries.build_comment_queryset(track, sort, comment_filter)
comments.queries.get_comment_page_context(request)
core.views.comments(request)
```

`core.views.comments()` 每次 GET 都会调用 `get_comment_page_context()`，其中 `comments = list(queryset)` 会在视图层强制执行 ORM 查询。响应头设置为：

```text
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
Pragma: no-cache
Expires: 0
```

因此以下入口都会重新访问数据库：

```text
/comments/
/comments/?track=<track_id>
/comments/?track=<track_id>&sort=hot
/comments/?track=<track_id>&sort=new
/comments/?track=<track_id>&filter=questions
```

前端切歌时会把当前 `track.id` 写入底部评论按钮的 `hx-get`，并在评论页处于打开状态时重新请求：

```text
/comments/?track=<current_track_id>
```

## 12. 2026-05-10 数据与接口补充

### Track 播放量

播放量上报接口：

```text
POST /tracks/<track_id>/play/
```

实现位于：

```text
tracks.views.record_play
```

写入策略继续使用 `F("plays") + 1`，避免并发请求覆盖：

```python
Track.objects.filter(pk=pk, status=Track.STATUS_PUBLISHED).update(plays=F("plays") + 1)
```

前端播放状态中的同一首歌只上报一次，切歌后重置上报 key。

### Lyrics 状态

`lyrics.TrackLyrics.status` 已用于区分：

```text
available      有歌词
instrumental   无歌词的纯音乐
pending        暂无歌词
```

`parse_raw_text()` 对非 `available` 直接返回，不生成 `TrackLyricLine`。因此数据库里 `instrumental` / `pending` 歌词版本可以存在，但不应有歌词行。

### 评论/歌词 Query 参数约定

数据库层和后端视图只按请求里的 `track` 参数解析当前资源：

```text
/lyrics/?track=<track_id>
/comments/?track=<track_id>
```

前端必须保证底部按钮发出的 `track` 是当前播放 track。不要让中部页面 URL 的旧 `track` 覆盖全局播放状态。

### 上传格式

当前 `Track.audio_file` 上传只支持普通音频文件：

```text
.mp3 .wav .ogg .m4a .aac .flac .webm
```

`.ncm` 没有落库策略，也没有转换依赖。数据库文档中不要把 `.ncm` 记为已支持格式。

## 13. 2026-05-11 阶段状态与后续数据规划

当前版本已经具备初步可用的大作业演示能力：

- 音乐作品、专辑、评论、歌词均已接入 Django ORM。
- 上传页可以保存音频、封面和歌词状态。
- 播放量接口已使用 `F("plays") + 1` 实现并有测试覆盖。
- 评论页禁用缓存，切歌后按请求 track 重新读取数据库。
- 歌词页按 `track` 参数读取指定歌曲。
- `tests/test_views.py` 共有 18 个基础回归测试。

下一阶段需要新增或扩展的数据能力：

- 真实用户登录系统：用户资料、头像、上传者、评论作者、点赞用户。
- 播放历史/播放队列：替换当前按 `Track.updated_at` 推导的 `shell_recent_tracks` 和 `shell_queue_tracks`。
- 搜索系统：按标题、歌手、专辑、用户检索。
- 管理后台：内容上下架、评论审核、歌词审核、用户管理。

这些功能在建模时应优先保持 Django Admin 可管理、ORM 查询清晰，并继续用后端测试覆盖关键路径。
