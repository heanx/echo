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
