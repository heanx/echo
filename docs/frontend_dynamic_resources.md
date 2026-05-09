# Echo 前端动态资源与响应式约定

更新时间：2026-05-07

## 动态资源入口

前端封面不再只依赖写死的 CSS 渐变类。`Track` 和 `Album` 都提供：

- `cover_image`：上传到 `media/` 下的真实封面资源。
- `cover_url`：模板使用的统一封面 URL 属性。
- `cover_theme`：没有上传封面时的 fallback 主题。

模板渲染规则：

1. 优先使用 `cover_url` 作为 `background-image`。
2. 没有 `cover_url` 时使用 `cover-{{ cover_theme }}` 渐变类。
3. 可播放元素继续保留 `data-cover`，并新增 `data-cover-url`，让底部播放器和右侧栏能显示真实封面。

涉及模板：

- `templates/components/track_card.html`
- `templates/components/track_row.html`
- `templates/components/album_card.html`
- `templates/core/home.html`
- `templates/tracks/detail.html`
- `templates/base.html`

## 页面壳数据

`core.context_processors.user_status` 除用户状态外，也提供：

- `shell_recent_tracks`

左侧栏“最近播放”当前先从数据库中的 `Track.updated_at` 取最近 3 条，后续可以替换为真正的播放历史模型。

## 响应式布局

`templates/base.html` 的页面壳使用以下断点：

- `>= 1280px`：左侧栏、中部内容、右侧播放上下文三栏布局。
- `< 1280px`：隐藏右侧播放上下文，主内容占满剩余空间。
- `< 1024px`：隐藏左侧栏，避免三栏固定宽度挤压内容。
- `< 640px`：压缩顶部栏和播放器高度，隐藏播放器进度条，保留核心播放控制。

不要在小屏下继续保留空的 `--left-width` 或 `--right-width` 栅格轨道，否则会再次出现内容被挤到左侧、右侧大片空白的问题。

## 2026-05-10 前端最新状态

### 播放器状态源

前端壳当前以 `static/js/echo-shell.js` 中的 `currentTrackId` 作为播放状态源，并同步到：

```text
localStorage.echo_current_track_id
```

底部歌词和评论按钮不能只看当前页面 URL。点击 `#lyrics-nav` 或 `#comments-nav` 时，应优先使用：

```text
currentTrackId -> localStorage.echo_current_track_id -> URLSearchParams(track)
```

这样可以避免中部页面仍停留在旧 `track` 时，底部按钮打开旧歌曲的歌词或评论。

### 底部歌词/评论按钮

`setCurrentTrack(trackId)` 负责同步：

```text
#lyrics-nav[hx-get="/lyrics/?track=<track_id>"]
#comments-nav[hx-get="/comments/?track=<track_id>"]
```

同一函数也会更新 `href`，虽然当前元素是 button，但保留 `href` 是为了兼容后续可能改回链接或无 HTMX fallback。

### 播放列表控制

播放列表以右侧栏 DOM 顺序为准：

```text
#playlist-track-list .playlist-track[data-echo-track]
```

上一首、下一首和播放结束自动下一首都调用 `playPlaylistOffset(offset)`。如果当前播放曲目不在列表中，下一首从列表第一首开始，上一首从最后一首开始。

### 进度条与歌词

进度条拖动时不要在 `input` 事件里反复写 `audio.currentTime`。当前约定是：

- `input`：只预览时间和歌词高亮。
- `change` / `pointerup`：真正 seek。
- 拖动期间歌词不自动滚动。

歌词页使用：

```text
.lyrics-line[data-start-ms]
lyric-dist-0 ... lyric-dist-4
lyric-dist-far
```

点击歌词行会跳转到该行时间。

### 上传页前端

音乐上传页支持普通浏览器可播放音频格式：

```text
.mp3 .wav .ogg .m4a .aac .flac .webm
```

`.ncm` 支持已经撤回，不要在 accept、提示文案或前端预听逻辑里重新加入 `.ncm`，除非后端重新确定转换方案。
