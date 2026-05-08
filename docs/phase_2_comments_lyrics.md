# Echo Phase 2 评论与歌词数据设计

更新时间：2026-05-09

## 1. 阶段定位

Phase 2 目标是把当前临时展示的评论页和歌词页整理为可落库、可交互、可继续扩展的业务模块。

当前已完成的前端入口：

- `core.views.lyrics()`：渲染中部主内容歌词界面。
- `core.views.comments()`：渲染中部主内容评论界面。
- `templates/core/lyrics.html`：主题蓝歌词沉浸页。
- `templates/core/comments.html`：评论列表、输入框、筛选入口。
- 底部播放器“歌词台词”和“评论”按钮通过 HTMX 切换中部 `#main-content`。

注意：评论和歌词是中部主界面，不属于右侧播放上下文栏。右侧栏继续用于当前播放信息、封面、艺人/作品上下文。

## 1.1 当前落地状态（2026-05-09）

Phase 2 已从“推荐设计”推进到可运行原型，当前仓库包含真实 app、模型、查询和模板：

- `comments/`
  - `comments.models.TrackComment`
  - `comments.models.TrackCommentReaction`
  - `comments.queries.get_comment_page_context()`
  - `comments.views.create_comment()`
  - `comments/urls.py`
  - `templates/comments/comment_item.html`
- `lyrics/`
  - `lyrics.models.TrackLyrics`
  - `lyrics.models.TrackLyricLine`
  - `lyrics.views.upload_lyrics()`
  - `lyrics/urls.py`
  - `templates/lyrics/upload.html`
- `core.views.comments()` 已从数据库读取评论上下文。
- `core.views.lyrics()` 已从数据库读取歌词上下文。
- 底部播放器播放曲目变化时会更新歌词/评论链接，并在当前中部主界面为歌词或评论页时自动刷新对应资源。
- 左侧“创建”菜单已包含“上传歌词”入口。

当前仍属于原型阶段，评论点赞、评论回复 UI、播放器 `timeupdate` 高亮歌词、播放量统计接口仍未完全落地。

## 2. 已新增 app

已新增两个业务 app：

```text
comments/
lyrics/
```

当前已按独立业务 app 落地。后续不要再把评论/歌词合并回 `tracks/`。

## 3. 评论数据结构

### 3.1 TrackComment

推荐模型：

```python
class TrackComment(models.Model):
    track = models.ForeignKey("tracks.Track", on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    parent = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies")

    author_name = models.CharField(max_length=120, blank=True)
    body = models.TextField()
    timestamp_ms = models.PositiveIntegerField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="published")
    is_pinned = models.BooleanField(default=False)
    is_question = models.BooleanField(default=False)
    is_creator_reply = models.BooleanField(default=False)

    like_count = models.PositiveIntegerField(default=0)
    reply_count = models.PositiveIntegerField(default=0)
    report_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

字段说明：

- `track`：评论所属音频。
- `user`：登录用户。允许为空，便于开发期匿名评论或导入旧评论。
- `parent`：回复关系。为空代表一级评论。
- `author_name`：匿名/导入/缓存展示名。登录用户优先从 `user` 取。
- `body`：评论正文。
- `timestamp_ms`：评论关联到歌曲时间点，支持“1:23 这里鼓点很好”。
- `status`：建议包括 `published`、`pending`、`hidden`、`deleted`。
- `is_pinned`：置顶评论。
- `is_question`：问题型评论，用于“问题”筛选。
- `is_creator_reply`：作者/创作者回复标识。
- `like_count`、`reply_count`、`report_count`：冗余计数，便于列表性能。

推荐索引：

```python
indexes = [
    models.Index(fields=["track", "-is_pinned", "-like_count", "-created_at"]),
    models.Index(fields=["track", "status", "-created_at"]),
    models.Index(fields=["track", "is_question", "-created_at"]),
    models.Index(fields=["parent", "created_at"]),
]
```

### 3.2 TrackCommentReaction

用于记录用户是否点过赞，避免重复点赞。

```python
class TrackCommentReaction(models.Model):
    comment = models.ForeignKey("comments.TrackComment", on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reaction = models.CharField(max_length=20, default="like")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["comment", "user", "reaction"], name="unique_comment_user_reaction")
        ]
```

### 3.3 评论排序与筛选

前端目前预留三个筛选：

- `热门`：置顶优先，其次点赞数、回复数、创建时间。
- `最新`：按创建时间倒序。
- `问题`：`is_question=True`，置顶优先。

推荐 query 参数：

```text
/comments/?track=<id>&sort=hot
/comments/?track=<id>&sort=new
/comments/?track=<id>&filter=questions
```

## 4. 歌词数据结构

### 4.1 TrackLyrics

一首歌可能有多份歌词：原文、翻译、罗马音、逐词歌词等。

```python
class TrackLyrics(models.Model):
    track = models.ForeignKey("tracks.Track", on_delete=models.CASCADE, related_name="lyrics_sets")
    language = models.CharField(max_length=20, default="zh-Hans")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="original")

    source_file = models.FileField(upload_to="tracks/lyrics/", blank=True, null=True)
    raw_text = models.TextField(blank=True)
    parser_version = models.CharField(max_length=40, blank=True)

    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

字段说明：

- `track`：歌词所属音频。
- `language`：歌词语言。
- `kind`：`original`、`translation`、`romanized`、`word_by_word`。
- `source_file`：上传的 `.lrc`、`.srt`、`.txt` 等文件。
- `raw_text`：原始歌词文本，便于调试和重新解析。
- `parser_version`：解析器版本，方便以后重新生成行数据。
- `is_primary`：默认展示版本。

推荐约束：

```python
models.UniqueConstraint(
    fields=["track", "language", "kind"],
    name="unique_track_lyrics_variant",
)
```

### 4.2 TrackLyricLine

用于同步歌词逐行展示。

```python
class TrackLyricLine(models.Model):
    lyrics = models.ForeignKey("lyrics.TrackLyrics", on_delete=models.CASCADE, related_name="lines")
    start_ms = models.PositiveIntegerField()
    end_ms = models.PositiveIntegerField(null=True, blank=True)
    text = models.TextField()
    translation = models.TextField(blank=True)
    position = models.PositiveIntegerField(default=0)
```

推荐索引：

```python
indexes = [
    models.Index(fields=["lyrics", "start_ms"]),
    models.Index(fields=["lyrics", "position"]),
]
```

### 4.3 歌词解析规则

Phase 2 初期建议支持：

- `.lrc`：`[mm:ss.xx] lyric text`
- `.txt`：纯文本，无时间戳，按行展示。
- `.srt`：可后置支持。

解析策略：

1. 上传文件保存到 `TrackLyrics.source_file`。
2. 将原文保存到 `raw_text`。
3. 解析生成 `TrackLyricLine`。
4. 如果没有时间戳，`start_ms` 可按行号生成占位时间，或者设为 `0` 并只按 `position` 排序。
5. 播放器 `timeupdate` 后续可根据 `audio.currentTime` 高亮当前行。

## 5. 当前模板接入点

当前前端页面：

- `templates/core/lyrics.html`
  - 使用 `track`
  - 使用 `lyrics_lines`
- `templates/core/comments.html`
  - 使用 `track`
  - 使用 `comments`

Phase 2 落库后建议改为：

当前代码已基本按这个方向实现。继续调整时优先阅读：

- `core/views.py`
- `comments/queries.py`
- `templates/core/comments.html`
- `templates/comments/comment_item.html`
- `templates/core/lyrics.html`
- `templates/lyrics/upload.html`

```python
def lyrics(request):
    track = resolve_playback_track(request)
    lyrics_set = track.lyrics_sets.filter(is_primary=True).first()
    lines = lyrics_set.lines.order_by("position", "start_ms") if lyrics_set else []
    return render(request, "core/lyrics.html", {"track": track, "lyrics_lines": lines})
```

```python
def comments(request):
    track = resolve_playback_track(request)
    sort = request.GET.get("sort", "hot")
    comments = TrackComment.objects.for_track(track).visible().sorted(sort)
    return render(request, "core/comments.html", {"track": track, "comments": comments})
```

## 6. HTMX 交互约定

底部播放器按钮保留：

```html
hx-get="{% url 'lyrics' %}"
hx-select="#main-content"
hx-target="#main-content"
hx-swap="outerHTML"
hx-push-url="true"
```

评论提交建议：

```html
hx-post="{% url 'comments:create' track.id %}"
hx-target="#comments-list"
hx-swap="afterbegin"
```

歌词上传建议接入“创建”菜单中的“上传歌词”：

```text
/lyrics/upload/?track=<id>
```

当前已接入左侧创建菜单，入口为：

```django
{% url 'lyrics:upload' %}
```

底部播放器会按当前曲目给 `#lyrics-nav`、`#comments-nav` 写入：

```text
/lyrics/?track=<track_id>
/comments/?track=<track_id>
```

如果当前主内容带有 `data-echo-resource="lyrics"` 或 `data-echo-resource="comments"`，播放新曲目后会自动重新 fetch 对应页面并替换 `#main-content`。

## 7. 当前前端壳联动约定

Phase 2 的歌词/评论入口和播放器、页面壳绑定较深，修改时保留以下 DOM/JS 约定：

- `#lyrics-nav`
- `#comments-nav`
- `#main-content`
- `[data-echo-resource]`
- `[data-echo-track]`
- `data-id`
- `data-title`
- `data-artist`
- `data-cover`
- `data-cover-url`

底部播放器按钮的 tooltip 已统一为水平弹出，避免覆盖内容区；不要把歌词/评论按钮挪进右侧播放上下文栏。

## 8. 后续实施顺序建议

已完成：

1. 新增 `comments` app，落地 `TrackComment` 和 `TrackCommentReaction`。
2. 把 `core.views.comments()` 从 mock 数据切到 ORM。
3. 新增评论提交 HTMX partial。
4. 新增 `lyrics` app，落地 `TrackLyrics` 和 `TrackLyricLine`。
5. 支持 `.lrc`/纯文本上传和解析。
6. 把 `core.views.lyrics()` 从 mock 行切到 ORM。
7. 给 `seed_demo` 增加演示评论和歌词数据。

待完成：

1. 评论点赞接 `TrackCommentReaction` 的创建/撤销接口，并同步 `like_count`。
2. 评论回复 UI 接 `parent`，同步 `reply_count`。
3. 歌词页接播放器 `timeupdate`，按 `TrackLyricLine.start_ms/end_ms` 高亮当前行。
4. 播放点击时通过后端接口记录 `Track.plays`。
5. 上传歌词后增加更清晰的错误提示和解析预览。
6. 增加权限/登录态后，将匿名 `author_name` 逐步替换为真实用户展示。

## 9. 验证命令

```powershell
.\.venv\Scripts\python.exe manage.py check
```

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from django.test import Client; c=Client(); paths=['/','/lyrics/','/comments/']; [print(path, (r:=c.get(path, HTTP_HOST='127.0.0.1')).status_code, 'main-content' in r.content.decode(errors='ignore')) for path in paths]"
```
