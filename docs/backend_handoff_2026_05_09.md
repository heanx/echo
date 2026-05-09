# Echo 后端交接文档

更新时间：2026-05-09  
适用对象：下一轮负责后端或全栈对接的 Codex

## 1. 当前项目状态

Echo 是 Django + SQLite3 + Tailwind CSS + HTMX + 原生 JavaScript 的轻量级音频分享社区项目。前端壳已经持续扩展，后端也不再只是最小 demo，目前已具备：

- 音频作品 `tracks`
- 专辑/合集 `albums`
- 评论 `comments`
- 歌词 `lyrics`
- SQLite WAL 连接配置
- demo 数据命令 `seed_demo`
- 首页、音乐列表、上传、详情、评论页、歌词页、歌词上传页

项目入口：

```text
manage.py
echo_project/settings.py
echo_project/urls.py
```

开发服务器脚本：

```text
tools/run_dev_server.bat
```

常用运行命令：

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

## 2. 已安装/注册的 app

`echo_project/settings.py` 中已注册：

```text
core
tracks
albums
comments
lyrics
```

`core.context_processors.user_status` 已加入模板 context processors。

## 3. URL 总览

项目路由位于 `echo_project/urls.py`：

```text
/admin/
/                         -> core.urls
/tracks/                  -> tracks.urls
/albums/                  -> albums.urls
/comments/                -> comments.urls
/lyrics/                  -> lyrics.urls
```

`core.urls`：

```text
/                         -> core.views.home, name="home"
/lyrics/                  -> core.views.lyrics, name="lyrics"
/comments/                -> core.views.comments, name="comments"
```

`tracks.urls`：

```text
/tracks/                  -> tracks:list
/tracks/latest/           -> tracks:latest
/tracks/upload/           -> tracks:upload
/tracks/<pk>/             -> tracks:detail
```

`albums.urls`：

```text
/albums/                  -> albums:list
```

`comments.urls`：

```text
POST /comments/<track_id>/create/ -> comments:create
```

`lyrics.urls`：

```text
/lyrics/upload/           -> lyrics:upload
```

## 4. 数据库模型

### Tracks

文件：`tracks/models.py`

核心模型：`Track`

字段包括：

```text
title
artist
description
audio_file
cover_image
cover_theme
duration_ms
status
created_at
updated_at
likes
plays
```

状态值：

```text
draft
published
hidden
deleted
```

默认页面只展示 `status=published` 的 Track。

重要属性：

```text
audio_url
cover_url
play_count
like_count
uploader
```

没有上传音频时，`audio_url` 回退到：

```text
/static/demo/demo-audio.mp3
```

注意：这个 demo 文件路径用于前端测试，不一定存在真实音频文件。

### Albums

文件：`albums/models.py`

核心模型：

```text
Album
AlbumTrack
```

`Album` 支持：

```text
title
creator
description
cover_theme
cover_image
tracks = ManyToManyField(... through=AlbumTrack)
```

`AlbumTrack` 保存专辑曲目排序：

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

### Comments

文件：

```text
comments/models.py
comments/queries.py
comments/views.py
```

核心模型：

```text
TrackComment
TrackCommentReaction
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

评论层级策略：

- 数据库层允许 `parent` 自关联。
- 保存时强制降维为两级评论树。
- 回复二级评论时，会把 `parent` 改为一级评论，并把被回复人写入 `reply_to_user_name`。

评论查询集中在 `comments/queries.py`：

```text
resolve_comment_track(request)
build_comment_queryset(track, sort, comment_filter)
get_comment_page_context(request)
```

评论页每次 GET 都会重新访问数据库，并设置禁用缓存响应头：

```text
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
Pragma: no-cache
Expires: 0
```

排序规则：

```text
hot        置顶 -> like_count -> reply_count -> created_at
new        置顶 -> created_at
questions 只看 is_question=True
```

评论提交：

```text
POST /comments/<track_id>/create/
```

提交支持字段：

```text
body
author_name
parent
reply_to_user_name
timestamp_ms
```

HTMX 请求成功时返回：

```text
templates/comments/comment_item.html
```

### Lyrics

文件：

```text
lyrics/models.py
lyrics/views.py
```

核心模型：

```text
TrackLyrics
TrackLyricLine
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

业务保护：

- 同一首歌只能有一个 `is_primary=True` 的歌词版本。
- 保存 primary 版本时，会自动把同一 track 的其他版本置为 `is_primary=False`。

`TrackLyricLine` 字段：

```text
lyrics
start_ms
end_ms
text
translation
position
```

解析入口：

```python
lyrics.parse_raw_text()
```

当前支持：

```text
[mm:ss.xx] lyric text
纯文本逐行解析
```

纯文本没有时间戳时，按行号生成 5 秒间隔的占位时间。

## 5. Core 聚合视图

文件：`core/views.py`

### 首页

```text
core.views.home
```

只读取已发布 Track：

```python
Track.objects.filter(status=Track.STATUS_PUBLISHED)
```

模板变量：

```text
hero_track
recommended_tracks
latest_tracks
hot_albums
```

### 歌词页

```text
core.views.lyrics
```

读取规则：

```text
/lyrics/?track=<track_id>
```

如果没有传 `track`：

1. 优先找有 primary lyrics 的 published track。
2. 其次找任意有 lyrics 的 published track。
3. 最后回退最近更新的 published track。

模板：

```text
templates/core/lyrics.html
```

模板变量：

```text
track
lyrics_set
lyrics_lines
```

### 评论页

```text
core.views.comments
```

读取规则：

```text
/comments/?track=<track_id>&sort=hot
/comments/?track=<track_id>&sort=new
/comments/?track=<track_id>&filter=questions
```

实际查询由 `comments/queries.py` 提供。每次进入评论页都重新查数据库，不复用旧 HTML。

模板：

```text
templates/core/comments.html
templates/comments/comment_item.html
```

## 6. Context Processor

文件：`core/context_processors.py`

提供：

```text
display_name
user_avatar_url
unread_message_count
friend_request_count
shell_recent_tracks
```

`display_name` 规则：

1. 登录：`user.get_full_name()`
2. 其次：`user.username`
3. 未登录：`Echo 用户`

`user_avatar_url`：

- 如果 `user.profile.avatar` 存在则返回头像 URL。
- 否则返回空字符串。

`shell_recent_tracks`：

- 当前从 `Track.updated_at` 取最近 10 首 published track。
- 前端左侧栏"最近播放"使用它。
- 后续可替换为真正播放历史模型。

## 7. SQLite 配置

文件：

```text
core/db.py
core/apps.py
```

`CoreConfig.ready()` 会注册 SQLite pragmas：

```text
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA busy_timeout=5000;
```

验证命令：

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from django.db import connection; c=connection.cursor(); print(c.execute('PRAGMA journal_mode;').fetchone()[0]); print(c.execute('PRAGMA busy_timeout;').fetchone()[0])"
```

预期：

```text
wal
5000
```

## 8. 上传音乐

文件：

```text
tracks/views.py
templates/tracks/upload.html
```

上传页现在不仅创建 Track，也可以同时创建歌词。

POST 字段包括：

```text
title
artist
description
status
duration_ms
audio_file
cover_theme
cover_image
lyrics_language
lyrics_kind
lyrics_file
lyrics_raw_text
```

保存流程：

1. 校验 `title`。
2. 创建 `Track`。
3. 如果有 `lyrics_raw_text` 或 `lyrics_file`，创建 `TrackLyrics`。
4. 调用 `lyrics.parse_raw_text()` 创建 `TrackLyricLine`。
5. 跳转到 `tracks:detail`。

注意：

- `duration_ms` 做了基础容错，非法值会变成 `0`。
- `status` 非法值会回退到 `published`。

## 9. 前端壳相关后端契约

文件：`templates/base.html`

当前 base 壳依赖后端变量：

```text
shell_recent_tracks
display_name
user_avatar_url
unread_message_count
friend_request_count
```

播放器按钮依赖每个 track 元素带：

```text
data-echo-track
data-src
data-id
data-title
data-artist
data-cover
data-cover-url
```

底部歌词/评论按钮会根据当前播放 track 更新：

```text
/lyrics/?track=<id>
/comments/?track=<id>
```

如果当前中部正处于歌词或评论页，切歌会自动刷新中部内容。

### Home 按键当前语义

Home 按键不是普通链接，而是"重置中部工作区"：

- 默认恢复 `#main-content` 到首页内容。
- 如果中部表单有未保存编辑，会弹窗确认。
- 确认后请求 `/`，替换 `#main-content`。

当前相关实现都在 `templates/base.html`。

最近多轮修改集中在顶部栏布局：

- 保持 Home + 搜索框尽量视觉居中。
- 当检测到会和左侧 Logo 或右侧按钮重叠时，切换为 grid 中间列内布局。
- 相关 JS 函数：`updateTopSearchLayout()`。

请下轮继续修改顶部栏时务必实际检查 hover/click 是否被遮挡。

## 10. Demo 数据

文件：

```text
tracks/management/commands/seed_demo.py
```

命令：

```powershell
.\.venv\Scripts\python.exe manage.py seed_demo
```

会创建/更新：

- 8 首 Track
- 5 个 Album
- AlbumTrack 专辑曲目关系
- 第一首歌的置顶评论、普通评论、问题评论、回复
- 3 首歌的 primary LRC 歌词和歌词行

`seed_demo` 使用 `update_or_create`，可以重复执行。

## 11. 已有文档

建议下一轮先读：

```text
docs/database_integration.md
docs/phase_2_comments_lyrics.md
docs/frontend_dynamic_resources.md
docs/backend_comments_lyrics_integration.md
docs/handoff_frontend_backend.md
```

其中：

- `database_integration.md` 是数据库总体设计。
- `phase_2_comments_lyrics.md` 是评论/歌词设计。
- `frontend_dynamic_resources.md` 是前端资源动态化约定。
- `backend_comments_lyrics_integration.md` 是评论/歌词后端落地说明。

## 12. 验证命令

系统检查：

```powershell
.\.venv\Scripts\python.exe manage.py check
```

迁移检查：

```powershell
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

页面烟测：

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from django.test import Client; c=Client(); paths=['/','/lyrics/','/comments/','/tracks/','/tracks/latest/','/tracks/upload/','/albums/','/lyrics/upload/']; [print(path, c.get(path, HTTP_HOST='127.0.0.1').status_code) for path in paths]"
```

数据烟测：

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from tracks.models import Track; from albums.models import Album; from comments.models import TrackComment; from lyrics.models import TrackLyrics, TrackLyricLine; print('tracks', Track.objects.count()); print('albums', Album.objects.count()); print('comments', TrackComment.objects.count()); print('lyrics', TrackLyrics.objects.count()); print('lines', TrackLyricLine.objects.count())"
```

评论动态查询验证：

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from django.test import Client; from django.db import connection; from django.test.utils import CaptureQueriesContext; c=Client(); [print(i, c.get('/comments/?track=1', HTTP_HOST='127.0.0.1').status_code) for i in range(2)]"
```

## 13. 当前已知风险和待办

### 高优先级

- 顶部栏 Home + 搜索框布局最近改动较多，需要浏览器实测不同宽度下是否重叠、hover 是否正常、Home 是否能重置中部。
- 评论点赞还没有接口，需要基于 `TrackCommentReaction` 增加创建/撤销逻辑，并用 `F()` 更新 `like_count`。
- 播放量上报还没有接口，需要用 `F("plays") + 1` 避免并发覆盖。

### 中优先级

- 评论回复 UI 仍较初级，后端支持 `parent`，但前端还没有完整回复表单。
- 歌词页还没有根据播放器 `timeupdate` 高亮当前行。
- 上传音乐页已经能同时保存歌词，但还没有前端解析音频时长，需要用户手动填 `duration_ms`。
- `/static/demo/demo-audio.mp3` 只是回退路径，当前项目不保证这个静态文件真实存在。

### 低优先级

- `shell_recent_tracks` 目前只是按 `Track.updated_at` 排序，不是真实播放历史。
- 如果进入多人使用阶段，建议从 SQLite 迁移到 PostgreSQL。

## 14. 当前 Git 状态提示

本轮扫描时工作区显示：

```text
M core/context_processors.py
M templates/base.html
```

这两处主要是前端壳和 context processor 的近期改动。下轮修改前请先 `git status --short`，不要覆盖用户或前端 Codex 的未提交改动。

## 15. 音乐上传与歌词业务最新状态

### 15.1 音乐上传入口

入口：

```text
GET/POST /tracks/upload/
```

视图：

```text
tracks.views.upload_track
```

模板：

```text
templates/tracks/upload.html
```

当前上传音乐时会真实保存音频文件到：

```text
media/tracks/audio/
```

封面文件保存到：

```text
media/tracks/covers/
```

音频文件现在是必填项。后端允许的音频扩展名：

```text
.mp3
.wav
.ogg
.m4a
.aac
.flac
.webm
```

音频大小限制为 50MB。封面允许 `.jpg`、`.jpeg`、`.png`、`.webp`、`.gif`，大小限制为 8MB。

### 15.2 音频内嵌信息自动填充

音乐上传页会尝试读取音频内嵌 ID3 标签，并自动填入：

```text
TIT2 -> title
TPE1 -> artist
TALB -> description 里的"专辑：xxx"
```

用户仍然可以手动修改标题、作者、简介。前端会避免覆盖用户已经手动编辑过的字段。

后端也有兜底解析：

```text
tracks.views._read_audio_metadata()
```

如果用户没有填写标题，但音频文件里有 `TIT2`，后端会使用该标题创建作品。如果前端和后端都无法读取标题，则返回：

```text
没有从音频文件中读取到标题，请手动填写标题
```

### 15.3 歌词状态

`lyrics.models.TrackLyrics` 新增字段：

```text
status
```

可选值：

```text
available      有歌词
instrumental   无歌词的纯音乐
pending        暂无歌词
```

迁移文件：

```text
lyrics/migrations/0003_tracklyrics_status.py
```

当前本地数据库已经执行过：

```powershell
.\.venv\Scripts\python.exe manage.py migrate
```

当 `status=available` 时，可以上传 `.lrc` 或 `.txt`，也可以直接编辑歌词文本；保存后调用 `TrackLyrics.parse_raw_text()` 并写入 `TrackLyricLine`。

当 `status=instrumental` 或 `status=pending` 时，不要求歌词文件和歌词文本，只保存歌词状态，清空 `raw_text`，不生成 `TrackLyricLine`。

`TrackLyrics.parse_raw_text()` 内部也有保护：非 `available` 状态不会生成歌词行。

### 15.4 音乐上传页内的歌词编辑器

音乐上传页的歌词区域现在是一个可编辑歌词工具：

```text
templates/tracks/upload.html
```

当前行为：

- 选择 `.lrc` 或 `.txt` 后，浏览器用 `FileReader` 读取文件内容。
- 读取结果会写入 `lyrics_raw_text`。
- 同时渲染到分列编辑器。
- LRC 会拆成"时间"和"歌词"两列。
- TXT 会按行拆成歌词列，时间列为空。
- 修改任意行会重新合成 `lyrics_raw_text`。
- 提交表单时后端仍然读取 `lyrics_raw_text`，所以后端解析逻辑保持兼容。

编辑器相关 DOM：

```text
#lyrics_file
#lyrics-file-hint
#lyrics-editor-rows
#lyrics-add-row
#lyrics-fill-current-time
#lyrics_raw_text
```

LRC 行解析格式：

```text
[mm:ss.xx] lyric text
```

### 15.5 歌词预听核对

音乐上传页内有独立预听播放器，用于人工核对歌词时间：

```text
#lyrics-preview-audio
#lyrics-preview-time
```

选择音频文件后，页面会创建本地 object URL，并设置给预听播放器。

"填入当前时间"按钮：

```text
#lyrics-fill-current-time
```

会把预听播放器当前时间写入当前选中的歌词行时间列。

时间格式：

```text
mm:ss.xx
```

### 15.6 独立歌词上传页

入口：

```text
GET/POST /lyrics/upload/
```

视图：

```text
lyrics.views.upload_lyrics
```

模板：

```text
templates/lyrics/upload.html
```

该页面现在也支持：

- 有歌词
- 无歌词的纯音乐
- 暂无歌词

当选择纯音乐或暂无歌词时，歌词语言、类型、文件、文本输入区域会禁用。

### 15.7 歌词展示页

入口：

```text
/lyrics/?track=<track_id>
```

模板：

```text
templates/core/lyrics.html
```

歌词行会输出：

```text
data-lyric-line
data-start-ms
data-position
```

当没有歌词行时，会根据歌词状态展示不同提示：

```text
instrumental -> 这首作品已标记为无歌词的纯音乐。
pending      -> 这首作品暂无歌词，之后可以从上传歌词页补充。
available    -> 还没有歌词。可以先运行 seed_demo，或从上传歌词页录入 LRC/纯文本。
```

### 15.8 播放量上报

入口：

```text
POST /tracks/<track_id>/play/
```

视图：

```text
tracks.views.record_play
```

内部使用：

```text
Track.objects.filter(pk=pk, status=Track.STATUS_PUBLISHED).update(plays=F("plays") + 1)
```

前端配置位于：

```text
templates/base.html
```

配置项：

```text
trackPlayUrlTemplate
csrfToken
```

页面中播放数显示使用：

```text
data-track-plays="<track_id>"
```

涉及模板：

```text
templates/components/track_card.html
templates/components/track_row.html
templates/tracks/detail.html
```

### 15.9 Demo 音频 fallback

`Track.audio_url` 在没有真实上传音频时返回：

```text
/static/demo/demo-audio.wav
```

文件：

```text
static/demo/demo-audio.wav
```

这个文件用于 demo 曲目 fallback，避免页面引用不存在的 demo 音频。

### 15.10 相关验证命令

系统检查：

```powershell
.\.venv\Scripts\python.exe manage.py check
```

迁移检查：

```powershell
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

页面烟测：

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from django.test import Client; c=Client(); paths=['/tracks/upload/','/lyrics/upload/','/lyrics/']; [print(path, c.get(path, HTTP_HOST='127.0.0.1').status_code) for path in paths]"
```

上传页内联脚本检查：

```powershell
$html = (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/tracks/upload/).Content
$scripts = [regex]::Matches($html, '<script>([\s\S]*?)</script>')
$i=0
foreach ($m in $scripts) {
  $path = Join-Path $env:TEMP "echo-upload-script-$i.js"
  Set-Content -Path $path -Value $m.Groups[1].Value -Encoding UTF8
  node --check $path
  $i++
}
```

### 15.11 后续维护注意事项

- 不要删除 `lyrics_raw_text`，上传页歌词编辑器最终仍靠它向后端提交歌词内容。
- 不要让 `instrumental` 或 `pending` 状态生成歌词行。
- 修改音乐上传页时，要同时确认 `lyrics_file` 读取、分列编辑器、预听播放器、表单提交四件事。
- 如果以后引入更强的音频元数据解析库，应保留当前无依赖 ID3 兜底逻辑，避免本地课程演示依赖安装失败。
- 当前分列歌词编辑器只在音乐上传页实现；独立歌词上传页仍是普通文本上传表单。

## 16. 2026-05-10 后端与全栈最新补充

### 16.1 Track 参数与播放状态

后端歌词页和评论页仍然使用显式 query 参数：

```text
/lyrics/?track=<track_id>
/comments/?track=<track_id>
```

前端壳现在保证底部歌词/评论按钮以当前播放中的 track 为准，而不是以当前页面 URL 为准。修复点在 `static/js/echo-shell.js`：

- `setCurrentTrack(trackId)` 同步 `currentTrackId`、`localStorage.echo_current_track_id`、底部按钮 `hx-get`。
- `resolvePlaybackTrackId()` 点击底部歌词/评论时优先读取当前播放状态，URL `track` 只兜底。

这个约定对后端很重要：后端继续只信任请求里的 `track` 参数；前端负责把正确的当前播放 track 写进请求。

### 16.2 歌词页

`core.views.lyrics(request)` 当前行为：

- 有 `track` 参数时，优先读取该 published Track。
- 无 `track` 参数时，优先找有 primary lyrics 的 published Track，其次找任意 lyrics，最后回退最近更新的 published Track。
- 模板输出歌词行：

```text
data-lyric-line
data-start-ms
data-position
```

`TrackLyrics.status` 支持：

```text
available
instrumental
pending
```

非 `available` 状态不会生成歌词行。歌词页空状态会根据 `instrumental` / `pending` / 普通缺歌词分别展示提示。

### 16.3 评论页

`core.views.comments(request)` 继续通过 `comments.queries.get_comment_page_context(request)` 构造上下文，并设置 no-cache 响应头：

```text
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
Pragma: no-cache
Expires: 0
```

这保证切歌后重新请求 `/comments/?track=<id>` 时不会复用旧 HTML。

### 16.4 播放量上报

播放量接口已落地：

```text
POST /tracks/<track_id>/play/
tracks.views.record_play
```

内部使用：

```python
Track.objects.filter(pk=pk, status=Track.STATUS_PUBLISHED).update(plays=F("plays") + 1)
```

前端 `audio play` 时会上报一次，同一首歌用 `playReportKey` 防止重复上报。接口返回：

```json
{"ok": true, "track_id": 10, "plays": 123}
```

页面内播放量节点使用：

```text
data-track-plays="<track_id>"
```

### 16.5 上传格式边界

后端允许的音频扩展名目前是：

```text
.mp3 .wav .ogg .m4a .aac .flac .webm
```

`.ncm` / `ncmdump` 支持已经撤回：

- `settings.py` 没有 `NCMDUMP_BIN`。
- `tracks.views` 没有 ncmdump 调用。
- 项目内没有打包 ncmdump 可执行文件。

如果未来重新做 `.ncm`，需要重新设计部署、授权、转换失败、超时、临时文件清理和前端提示，不要默认认为现在已经支持。

### 16.6 建议新增回归

```powershell
.\.venv\Scripts\python.exe manage.py check
```

手动验证：

1. 打开 `/lyrics/?track=12`。
2. 播放 `track=10`。
3. 点击底部歌词和评论。
4. 确认后端收到的是 `/lyrics/?track=10` 和 `/comments/?track=10`。
