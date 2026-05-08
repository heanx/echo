# Echo 评论与歌词后端对接说明

更新时间：2026-05-08

## 1. 本次后端落地范围

本次把前端 Phase 2 中的评论页和歌词页从 mock 数据切换为数据库驱动，保持现有页面视觉和 HTMX 切换方式不变。

新增 app：

```text
comments/
lyrics/
```

已接入页面：

```text
/comments/
/lyrics/
/lyrics/upload/
```

## 2. 评论数据

评论模型位于 `comments.models`。

核心模型：

```python
TrackComment
TrackCommentReaction
```

`TrackComment` 主要字段：

- `track`：关联 `tracks.Track`
- `user`：可为空，登录用户评论时使用
- `parent`：可为空，后续支持回复树
- `author_name`：匿名或导入数据的展示名
- `body`：评论正文
- `timestamp_ms`：评论关联的音频时间点，暂未在前端强展示
- `status`：`published`、`pending`、`hidden`、`deleted`
- `is_pinned`：置顶
- `is_question`：问题评论
- `is_creator_reply`：创作者回复
- `like_count`、`reply_count`、`report_count`：冗余计数

评论页读取逻辑：

```text
/comments/?track=<track_id>&sort=hot
/comments/?track=<track_id>&sort=new
/comments/?track=<track_id>&filter=questions
```

如果没有传 `track`，后端会回退到最近更新的 Track，保证底部栏按钮直接跳转时也能显示内容。

评论提交入口：

```text
POST /comments/<track_id>/create/
```

HTMX 提交成功后返回单条评论 partial：

```text
templates/comments/comment_item.html
```

普通表单提交成功后回到：

```text
/comments/?track=<track_id>
```

## 3. 歌词数据

歌词模型位于 `lyrics.models`。

核心模型：

```python
TrackLyrics
TrackLyricLine
```

`TrackLyrics` 主要字段：

- `track`：关联 `tracks.Track`
- `language`：默认 `zh-Hans`
- `kind`：`original`、`translation`、`romanized`、`word_by_word`
- `source_file`：上传的 `.lrc` 或 `.txt`
- `raw_text`：原始歌词文本
- `parser_version`：当前为 `simple-lrc-v1`
- `is_primary`：默认展示版本

`TrackLyricLine` 主要字段：

- `lyrics`：关联 `TrackLyrics`
- `start_ms`：开始时间，毫秒
- `end_ms`：结束时间，暂可为空
- `text`：歌词正文
- `translation`：翻译文本，暂可为空
- `position`：展示顺序

歌词页读取逻辑：

```text
/lyrics/?track=<track_id>
```

如果没有传 `track`，同样回退到最近更新的 Track。页面优先读取 `is_primary=True` 的歌词版本，否则读取该 Track 的第一份歌词。

歌词上传入口：

```text
/lyrics/upload/?track=<track_id>
```

上传页支持：

- 粘贴 LRC 文本
- 上传 `.lrc` / `.txt`
- 无时间戳纯文本按行生成占位时间

## 4. 前端模板变量

`templates/core/comments.html` 使用：

```text
track
comments
sort
filter
```

每条 `comment` 需要支持：

```text
author
badge
time
body
likes
replies
tone
question
```

这些已通过 `TrackComment` 模型属性兼容。

`templates/core/lyrics.html` 使用：

```text
track
lyrics_set
lyrics_lines
```

每条 `lyrics_line` 使用：

```text
line.time
line.text
```

其中 `time` 是 `TrackLyricLine` 的展示属性，由 `start_ms` 转为 `mm:ss`。

## 5. 初始化和验证命令

首次接入后执行：

```powershell
.\.venv\Scripts\python.exe manage.py makemigrations comments lyrics
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
```

验证：

```powershell
.\.venv\Scripts\python.exe manage.py check
```

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from django.test import Client; c=Client(); paths=['/','/lyrics/','/comments/','/lyrics/upload/']; [print(path, c.get(path, HTTP_HOST='127.0.0.1').status_code) for path in paths]"
```

## 6. 后续可扩展点

- 将底部播放器当前 track id 追加到 `/lyrics/?track=<id>` 和 `/comments/?track=<id>`。
- 给评论点赞按钮接入 `TrackCommentReaction`。
- 给回复按钮新增 `parent` 评论提交。
- 给歌词页增加播放器 `timeupdate` 高亮当前行。
- 支持 `.srt` 解析和翻译歌词并排展示。
