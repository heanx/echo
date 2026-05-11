# Echo 前端动态资源与响应式约定

更新时间：2026-05-11

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
- `shell_queue_tracks`

左侧栏“最近播放”当前先从数据库中的 `Track.updated_at` 取最近 3 条，右侧播放列表使用最近 10 条 published track。后续可以替换为真正的播放历史和真实播放队列模型。

## 响应式布局

`templates/base.html` 的页面壳使用以下断点：

- `>= 1280px`：左侧栏、中部内容、右侧播放上下文三栏布局。
- `< 1280px`：隐藏右侧播放上下文，主内容占满剩余空间。
- `< 1024px`：隐藏左侧栏，避免三栏固定宽度挤压内容。
- `< 640px`：压缩顶部栏和播放器高度，隐藏播放器进度条，保留核心播放控制。

不要在小屏下继续保留空的 `--left-width` 或 `--right-width` 栅格轨道，否则会再次出现内容被挤到左侧、右侧大片空白的问题。

## 2026-05-11 GUI 新规范待落地

新的 GUI 设计规范已经进入 TODO，目标是统一桌面、手机竖屏、手机横屏三类形态：

- 桌面 `> 960px`：左侧栏 + 主内容 + 右侧上下文三栏。
- 播放栏左右列必须对称，禁止右列使用 `auto` 破坏播放控制居中。
- JS 的右侧栏显示阈值需要和 CSS 断点统一，重点是 `960px / 820px / 480px`。
- 手机竖屏 `<= 480px`：全屏播放视图 + 底部 tab 栏。
- 手机横屏且 `max-height: 500px`：播放栏压缩到单行 `<= 56px`，左侧封面信息，右侧播放列表。
- 进度条视觉可以保持细线，但触摸响应区需要至少 `24px` 高。

当前代码只做了局部修复，尚未完整落地以上规范。继续改播放栏前，优先统一 JS/CSS 断点，避免右侧栏和底部栏各用一套规则。

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

`setCurrentTrack(trackId)` 负责同步当前播放 ID 和底部按钮的 `hx-get`：

```text
#lyrics-nav[hx-get="/lyrics/?track=<track_id>"]
#comments-nav[hx-get="/comments/?track=<track_id>"]
```

实际点击底部 `#lyrics-nav` / `#comments-nav` 时，`static/js/echo-shell.js` 会拦截同次 HTMX 点击，调用 `loadMainResource(resourceName, currentTrackId)` 直接请求当前播放 track 的歌词或评论。这样可以避免切歌后的自动刷新请求和手动点击请求互相覆盖。

`loadMainResource()` 内部使用：

- `AbortController` 取消旧请求。
- `mainResourceRequestId` 防止旧请求晚返回覆盖新内容。
- `extractMainContent()` 从完整页面响应里抽取真正的 `#main-content`，避免把整套 `base.html` 嵌进主内容区。

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

歌词展示的当前样式约定：

- `.lyrics-lines` 宽度限制为面板的约 `2/3`，移动端恢复 `100%`。
- 歌词字体使用 Arial/Helvetica。
- 当前行不再放大，只保留轻微右移。
- 长句允许在歌词宽度内自然换行。

### 上传页前端

音乐上传页支持普通浏览器可播放音频格式：

```text
.mp3 .wav .ogg .m4a .aac .flac .webm
```

`.ncm` 支持已经撤回，不要在 accept、提示文案或前端预听逻辑里重新加入 `.ncm`，除非后端重新确定转换方案。
