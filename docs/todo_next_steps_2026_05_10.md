# Echo Next Steps TODO

更新时间：2026-05-10

目标：把当前 Echo 从“功能原型”推进到“可稳定演示和继续迭代”的状态。建议先做工程稳定项，再补社区互动功能。

## P0 工程稳定

### 1. 修复中文乱码

现状：部分模板、JS、Python 文件里的中文已经出现 mojibake，功能仍能跑，但后续维护风险高。

优先文件：

- `templates/base.html`
- `static/js/echo-shell.js`
- `static/css/echo-shell.css`
- `tracks/views.py`
- `lyrics/models.py`
- `lyrics/views.py`
- `templates/core/lyrics.html`
- `templates/core/comments.html`
- `templates/tracks/upload.html`
- `templates/lyrics/upload.html`

验收：

- 页面可见文案恢复为正常中文。
- `python manage.py check` 通过。
- `node --check static/js/echo-shell.js` 通过。
- 上传页、歌词页、评论页、播放器按钮 tooltip 文案正常。

### 2. 加基础回归测试

建议先加轻量测试，避免继续修功能时反复打回旧 bug。

覆盖点：

- `/`, `/lyrics/`, `/comments/`, `/tracks/`, `/tracks/latest/`, `/tracks/upload/`, `/lyrics/upload/` 返回 200。
- `POST /tracks/<track_id>/play/` 会递增 `Track.plays`。
- `/comments/?track=<id>` no-cache 响应头存在。
- `/lyrics/?track=<id>` 能读取指定 track，而不是误回退。
- 上传页包含普通音频格式提示，不包含 `.ncm`。

可选前端回归：

- 页面 URL 停在 `/lyrics/?track=12` 时，播放 `track=10` 后点击底部歌词/评论，应请求 `track=10`。
- 拖动进度条后不会回到 `0:00`。

## P1 播放体验闭环

### 3. 真实播放队列状态

现状：上一首/下一首按右侧播放列表 DOM 顺序运行，已经可用，但还不是完整队列模型。

建议：

- 在前端维护 `playQueue` 和 `playQueueIndex`。
- 从首页、音乐库、详情页、播放列表点击时，明确队列来源。
- 保留当前 DOM 队列作为 fallback。
- 切歌时统一走 `playTrack()`，不要绕过 `setCurrentTrack()`。

验收：

- 音乐库点击 Dusk Till Dawn 后，下一首按预期队列播放。
- 播放列表点击任意歌曲后，上一首/下一首以列表顺序循环。
- 播放结束自动下一首。
- 底部歌词/评论始终跟随当前播放 track。

### 4. 播放模式

现有 UI 已有随机和循环按钮，但逻辑还不完整。

建议状态：

- `repeatMode`: `off | all | one`
- `shuffleEnabled`: `true | false`

验收：

- 单曲循环时 `ended` 重新播放当前音频。
- 列表循环时末尾回第一首。
- 随机播放不连续重复当前曲。

## P1 社区互动

### 5. 评论回复 UI

后端已有 `parent`、`reply_to_user_name`、`reply_count`。

TODO：

- 每条评论增加“回复”按钮。
- 点击后在该评论下展开回复框。
- 回复二级评论时，提交一级 parent，并写入 `reply_to_user_name`。
- HTMX 提交后插入或刷新对应评论块。

验收：

- 一级评论可回复。
- 二级评论可回复给具体用户，但数据库保持两级树。
- `reply_count` 正确递增。

### 6. 评论点赞

后端已有 `TrackCommentReaction`，但接口和前端交互未完整落地。

TODO：

- 增加点赞/取消点赞接口。
- 使用 `F()` 更新 `like_count`。
- 匿名用户策略需明确：允许临时匿名还是要求登录。
- 前端点赞按钮用 HTMX 或 fetch 更新局部计数。

验收：

- 重复点赞不会重复增加。
- 取消点赞会减少。
- 评论列表热度排序能体现 `like_count`。

## P2 歌词体验

### 7. 统一歌词上传/校对体验

现状：音乐上传页歌词编辑器较完整，独立歌词上传页较基础。

TODO：

- 把分列编辑器能力同步到 `templates/lyrics/upload.html`。
- 支持 LRC/TXT 文件载入后分列展示。
- 支持新增行、删除行、填入当前预听时间。
- 支持 `available / instrumental / pending` 状态切换禁用输入区。

验收：

- 音乐上传页和独立歌词上传页体验一致。
- `instrumental` / `pending` 不生成歌词行。
- 保存后 `/lyrics/?track=<id>` 正确展示。

### 8. 歌词高亮优化

现状：前端根据 `start_ms` 高亮，点击歌词可 seek。

可优化：

- 歌词行较多时改为二分查找。
- 用户手动滚动后暂停自动滚动的时长可调。
- 移动端歌词字号和 active 行缩放单独优化。

## P2 上传与媒体

### 9. 音频元数据解析增强

现状：前后端都有轻量 ID3 解析，主要支持 MP3。

可选方向：

- 引入更完整的后端音频元数据解析库。
- 自动读取封面图并保存为 `cover_image`。
- 自动读取时长，减少用户手填。

注意：

- 不要重新加入 `.ncm`，除非已经明确部署转换工具、授权风险、超时和临时文件清理方案。

## P3 产品整理

### 10. 设计一致性清理

TODO：

- 检查亮/暗模式下所有页面的对比度。
- 清理旧文案和乱码 tooltip。
- 保持歌词/评论为中部主界面，不移动到右侧栏。
- 避免把页面改成营销 landing，优先保留可用产品界面。

### 11. 文档持续维护

每完成一个模块，同步更新：

- `docs/handoff_frontend_backend.md`
- `docs/frontend_dynamic_resources.md`
- `docs/backend_handoff_2026_05_09.md`
- `docs/database_integration.md`

## 建议执行顺序

1. 修中文乱码。
2. 加基础后端回归测试。
3. 加播放器关键前端回归。
4. 实现评论回复 UI。
5. 实现评论点赞。
6. 抽统一歌词编辑器体验。
7. 做真实播放队列和播放模式。

理由：先把编码和回归稳定住，再做交互功能，后续迭代会更少踩旧坑。
