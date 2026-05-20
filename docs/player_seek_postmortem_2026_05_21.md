# 2026-05-21 播放器 seek 问题复盘

## 问题现象

底部播放器的播放按钮可用，音频可以正常开始播放，进度条、当前时间和总时长也都能显示。

问题集中在点击或拖动底部进度条时：

- 进度条会短暂跳到鼠标所在位置。
- 随后又回到 `0:00` 或旧时间。
- 拖动期间会在 `0:00` 和鼠标所在进度之间反复弹跳。

## 错误排查方向

前期排查过度集中在前端事件链：

- 原生 `<input type="range">` 的 `input` / `change`。
- `pointerdown` / `pointerup`。
- `preventDefault()` 是否阻断原生 range 拖动。
- `setPointerCapture()` 应该挂在 range 还是包装层。
- 静态资源缓存是否加载了旧 JS。

这些点会影响手感和显示，但不是这次问题的根因。

## 真正根因

这次问题由两部分叠加造成。

### 1. 前端异步 seek 竞态

`audio.currentTime = nextTime` 会触发浏览器媒体元素的异步 seek。它不是同步完成的赋值。

如果 seek 尚未完成：

- `timeupdate` 可能用旧的 `audio.currentTime` 写回 `progress.value`。
- `seeked` 也可能在用户仍在拖动时覆盖进度条。

这样就会和浏览器原生 range 拖动形成拉扯，表现为进度条在 `0:00` 和鼠标位置之间弹跳。

修复约束：

- `timeupdate` 更新进度条时需要避开 `audio.seeking`。
- `seeked` 在 `isSeeking` 为 true 时不要覆盖进度条。

### 2. 服务端没有正确支持 HTTP Range

浏览器音频 seek 依赖 HTTP Range 请求。设置 `audio.currentTime` 后，浏览器需要向服务端请求目标片段。

如果服务端没有正确处理 `Range: bytes=...`：

- 浏览器无法取得目标音频片段。
- `audio.currentTime` 可能回退到旧值或 `0`。
- 前端事件再怎么调整，也只能缓解 UI 表象，不能真正完成 seek。

Django `runserver` 默认静态文件服务不适合作为音频 seek 后端，因此项目需要自己的音频流视图。

## 当前修复

### 前端

文件：`static/js/echo-shell.js`

- `timeupdate` 写回进度条时增加 `!audio.seeking`。
- `seeked` 处理函数在 `isSeeking` 时直接返回。
- 目标是避免异步 seek 过程中用旧时间覆盖用户正在操作的进度条。

### 后端

文件：`core/views.py`

- 新增 `serve_audio(request, path)`。
- 解析 `Range` 请求头。
- 对范围请求返回 `206 Partial Content`。
- 设置 `Content-Range`、`Content-Length`、`Accept-Ranges: bytes`。

文件：`core/urls.py`

- 新增 `/stream/<path:path>` 路由。

文件：`tracks/models.py`

- `Track.audio_url` 改为返回 `/stream/...`，避免直接走 `media` 或 `static` URL。

## 回归检查清单

1. 在浏览器 Network 面板确认音频 seek 请求带 `Range: bytes=...`。
2. 确认响应状态是 `206 Partial Content`。
3. 确认响应头包含 `Content-Range` 和 `Accept-Ranges: bytes`。
4. 拖动进度条时 UI 不应回到 `0:00`。
5. `timeupdate` 不应在 `audio.seeking === true` 时覆盖进度条。
6. `seeked` 不应在 `isSeeking === true` 时覆盖进度条。

## 后续加固建议

- `serve_audio()` 应使用安全路径拼接，避免路径穿越。
- 大文件响应应避免一次性读完整文件。
- Range 解析应覆盖 `bytes=start-`、`bytes=start-end` 和非法范围。
- 若后续上生产环境，优先交给 Nginx、对象存储或专门的媒体服务处理 Range。
