# Echo Next Steps TODO

更新时间：2026-05-15

目标：把当前 Echo 从“可演示的课程原型”推进到“功能闭环更完整、工程地基更稳、可以继续迭代”的状态。

## 已完成

### P0 工程稳定

1. 中文乱码修复
- 状态：已完成（2026-05-10）

2. 基础后端回归测试
- 状态：已完成（2026-05-11）
- 当前结果：`tests/test_views.py` + `tests/test_error_urls.py` 共 45 个测试通过

3. 列表分页
- 状态：已完成（2026-05-11）
- 已覆盖：`/tracks/`、`/tracks/latest/`
- 已扩展：搜索结果页已接入分类分页和 HTMX 局部刷新

4. 全局错误处理与空状态
- 状态：已完成（2026-05-11）
- 已覆盖：404、500、toast、播放器错误提示、空列表/空歌词/空评论等

5. 真实播放模式
- 状态：已完成（2026-05-11）
- 已支持：`shuffleEnabled`、`repeatMode = off | all | one`
- 已支持：上一首、下一首、单曲循环、列表循环、随机播放历史回退
- 2026-05-13 修复：单曲循环改为同步 `audio.loop`，避免真实播放队列重构后影响单曲循环生效；`echo-shell.js` 增加版本参数避免浏览器缓存旧脚本
- 2026-05-13 二次修复：
  - `selectTrack()` 切换音频源后重新同步 `audio.loop`，防止浏览器媒体加载算法重置 loop 属性导致单曲循环失效
  - `playPlaylistOffset()` 顺序播放边界（首尾）和随机播放下 `repeatMode === "one"` 时改为回绕到列表首/尾或重播当前曲目，而非直接停止
  - 随机播放池耗尽且 `repeatMode === "one"` 时自动重播当前曲目
  - JS 版本参数更新为 `v=20260513-shuffle-repeat-fix`

6. 生产环境配置拆分
- 状态：核心完成（2026-05-13）
- 已完成：
  - `echo_project.settings.base`
  - `echo_project.settings.dev`
  - `echo_project.settings.prod`
  - `manage.py` / `wsgi.py` / `asgi.py` 默认走 `dev`
  - `prod` 下强制检查 `ECHO_SECRET_KEY`、`ECHO_ALLOWED_HOSTS`、`ECHO_DATABASE_URL`
- 待补：
  - `requirements/prod.txt`
  - 更完整的部署说明

7. 文件上传安全校验
- 状态：已完成（2026-05-13）
- 已完成：
  - 音频、图片、歌词文件扩展名校验
  - 文件大小校验
  - 文件头魔数校验
  - 拒绝空文件和伪装文件
- 已补回归测试：
  - `.exe` 伪装 `.mp3`
  - 假封面图片
  - 二进制歌词文件

8. 真实用户登录系统
- 状态：核心完成（2026-05-13）
- 已完成：
  - Django 注册、登录、退出
  - `UserProfile` 资料表：显示名、头像、简介
  - 顶部导航登录态 / 匿名态入口
  - 上传音乐、上传歌词要求登录
  - 上传作品绑定 `Track.owner`
  - 登录页支持“保持登录”，密码保存交给浏览器密码管理器
  - 注册页与资料设置页支持头像上传、文件名旁取消选择、默认放大预览、拖动裁剪位置和缩放
  - 头像限制为 JPG / PNG / WEBP，最大 4MB，后端继续做文件头校验；图片保存到媒体目录，数据库只保存文件路径

9. 左侧音乐库 hover 位移让位动画
- 状态：已完成（2026-05-15）
- `.library-collapse-button` 入场动画对齐右侧面板：`translateX(-10px) scale(.96)` → `translateX(0) scale(1)`（左滑 + 缩放入场）
- `.library-title-group` hover 时同步右移 `translateX(36px)`，为浮现的折叠按钮让位
- 移除 hover 时隐藏 `.sidebar-library-trigger` 书本图标的逻辑，图标保持可见
- 修改文件：`static/css/echo-shell.css`

10. 开发环境媒体 Range 响应
- 状态：已完成（2026-05-15）
- `DEBUG` 下 `/media/...` 改为 `serve_media_range()`，支持 `Range` 请求、`206 Partial Content`、`Content-Range` 和 `Accept-Ranges`
- 解决部分浏览器在本地开发服务器播放音频时，进度条 seek 后回到 `0:00` 的问题
- 修改文件：`core/views.py`、`echo_project/urls.py`

## 进行中

### 2026-05-14 审查跟进

本轮外部审查提出 5 个优先风险和 1 个可维护性隐患。当前工作区对照结果：

- 已覆盖：评论提交已限制 `Track.status = published`，隐藏 / 草稿 / 删除作品不能通过评论接口提交评论。
- 已覆盖：上传安全校验已从“只看扩展名”升级为扩展名、大小、文件头魔数校验；头像额外做图片解析和 Pillow 压缩。
- 已覆盖：顶部搜索框已提交到 `/search/` 独立搜索页，不再提交到 `/tracks/?q=`；搜索系统已补分类分页、相关性排序、播放队列入口和 Spotify 风格结果页体验。
- 已处理：`lyrics/views.py` 独立歌词上传读取 `source_file` 后已补 `source_file.seek(0)`，避免保存到 `FileField` 时文件指针停在 EOF。
- 已处理：`TrackComment.parent` 反向关系已改为 `child_comments`，移除 `TrackComment.replies` property，模板明确使用 `comment.replies_count` 和 `comment.child_comments.all`。
- 已处理：两处歌词编辑器重复逻辑已抽为 `static/js/lyrics-editor.js`，音频上传页和独立歌词上传页复用同一套解析、增删行、填当前时间和文件导入逻辑。

### P1 播放体验闭环

9. 真实播放队列模型
- 状态：已完成当前前端闭环（2026-05-15）
- 已完成：
  - 前端维护 `playQueue`、`playQueueIndex`、`playQueueName`
  - 从首页推荐、最新、左侧最近播放、音乐库、搜索结果、详情页、右侧播放列表等入口建立明确队列来源
  - 上一首、下一首、随机池、播放结束自动下一首改为基于真实队列
  - 队列状态本地持久化
  - 右侧播放列表由 `renderPlaylistQueue()` 根据 `playQueue` 重绘，不再以服务端首屏 DOM 作为真实队列源
  - `[data-play-queue]` 容器统一描述队列来源，`[data-echo-track]` 外层行/卡片支持点击播放和右键菜单
  - 右键菜单支持“立即播放 / 下一首播放 / 加入播放队列 / 从播放队列移除 / 查看歌曲”
- 后续可扩展：
  - 歌单详情页接入同一套队列来源
  - 队列持久化从 localStorage 升级为登录用户维度的服务端数据

## 已完成详情

### P1 用户与社区已完成项

10. 搜索系统
- 目标：把当前原型搜索升级为功能闭环的独立搜索模块，支持分类型浏览、分页、相关性排序和播放队列接入。
- 状态：已完成（2026-05-14）

### 10.1 搜索范围

| 模型 | 搜索字段 | 约束 |
|------|---------|------|
| Track | `title`, `artist`, `description`, `owner__username`, `owner__profile__display_name` | 仅 `status=PUBLISHED` |
| Album | `title`, `creator`, `description` | 无 |
| User | `username`, `first_name`, `last_name`, `profile__display_name` | 无 |

- 匹配方式：Django ORM `icontains`（LIKE 子串匹配），不做全文索引 / 分词 / 模糊纠错。
- 查询输入截断至 200 字符，避免滥用长查询。

### 10.2 相关性排序

Tracks 按匹配字段加权计分，用 `Case/When` 注解 `relevance` 整数字段后降序排列：

| 匹配字段 | 分值 |
|---------|------|
| `title__icontains` | 100 |
| `artist__icontains` | 80 |
| `owner__username__icontains` | 50 |
| `owner__profile__display_name__icontains` | 40 |
| `description__icontains` | 10 |

排序：`.order_by(“-relevance”, “-created_at”)`

Albums 同理简化：title 50、creator 30、description 5。

Users 按 username 升序即可。

### 10.3 URL 与视图模式

| URL | `type` 参数 | 行为 |
|-----|-----------|------|
| `/search/?q=...` | 无 | **摘要视图**：三类各展示前 20/6/6 条，附总数和”查看全部”链接 |
| `/search/?q=...&type=tracks` | `tracks` | **单类型分页**：仅歌曲，每页 20 条，带分页导航 |
| `/search/?q=...&type=albums` | `albums` | 单类型分页：仅专辑，每页 12 条（网格布局） |
| `/search/?q=...&type=users` | `users` | 单类型分页：仅用户，每页 12 条 |

无效 `type` 值 → 静默降级为摘要视图。无效 `page` → 跳转到合法页并 toast 提示。

### 10.4 分页策略

- 复用现有 `_paginate_queryset` / `_build_page_links` / `_parse_positive_int`，从 `tracks/views.py` 提取到 `core/utils.py` 共享。
- 分页导航复用 `templates/components/pagination.html`（HTMX 局部刷 `#main-content`，同时 push URL）。
- 单类型分页视图支持 `page` 和 `per`（上限 100）查询参数。

### 10.5 UI：类型标签页

摘要视图和分页视图顶部均有 pill 风格标签页：

```
[全部 (N)] [歌曲 (N)] [专辑 (N)] [用户 (N)]
```

- 当前活跃标签：`bg-brand text-white`
- 非活跃标签：`bg-zinc-100 dark:bg-zinc-900`，hover 变化
- 标签页独立 partial `templates/search/type_tabs.html`

### 10.6 摘要视图布局

- **歌曲区段**（`data-play-queue=”search-tracks”`）：最多 20 条，标题行右侧显示总数 + “查看全部 →”
- **专辑区段**：最多 6 张卡片网格，同上
- **用户区段**：最多 6 张用户卡片，同上
- 各区段无结果时显示独立空状态组件

### 10.7 播放队列接入

- 搜索结果的 tracks 区段包裹在 `[data-play-queue=”search-tracks”]` 容器内
- 每个 track 行带 `data-echo-track` 属性（已有 `components/track_row.html`）
- JS 侧 `resolveQueueContext()` 无需改动，自动将队列来源标为 `search-tracks`
- HTMX 分页换页后新 DOM 自带 `data-play-queue`，委托点击无需重新初始化

### 10.8 边界情况

| 场景 | 处理 |
|------|------|
| 空查询（`q` 缺失或纯空白） | 显示”输入关键词搜索”引导，不显示结果和标签页 |
| 超长输入（>200 字符） | 服务端 `query[:200]` 截断 |
| 全部类型零结果 | 显示全局空状态”没有找到结果，试试更短的关键词” |
| 某一类型零结果 | 该类型标签页显示计数 0，内容区显示独立空状态 |
| 无效 `type` 参数 | 静默降级为摘要视图 |
| 无效 `page` 参数 | 跳转到合法页并 toast 通知 |
| SQL 注入 | Django ORM 参数化查询自动防护 |
| XSS（查询词回显） | Django 模板 `{{ query }}` 自动转义 |
| 匿名用户 | 搜索不要求登录 |

### 10.9 改动文件清单

| 文件 | 改动 |
|------|------|
| `core/utils.py`（新） | 提取 `_parse_positive_int`、`_build_page_links`、`_paginate_queryset` |
| `tracks/views.py` | 删除三个私有函数，改为 `from core.utils import ...` |
| `core/views.py` | 重构 `search_view`，新增 `_search_tracks/albums/users` + 分页包装函数 |
| `templates/search/results.html` | 重写：标签页组件 + 摘要/分页双模式布局 |
| `templates/search/type_tabs.html`（新） | 类型标签页 partial |
| `templates/components/empty_state.html` | 确认空状态组件可复用（无需改动） |
| `templates/components/pagination.html` | 无需改动 |
| `templates/search/track_result_row.html`（新） | 搜索页歌曲行，外层带 `data-echo-track` |
| `static/js/echo-shell.js` | 顶部搜索建议、搜索结果队列接入、歌曲右键菜单 |

## 待办

### P1 用户与社区

11. 评论回复 UI
- 回复按钮
- 二级回复表单
- `parent` / `reply_to_user_name` 写入与展示
- 审查补充：`TrackComment.replies` 命名冲突已处理，后续可继续扩展回复 UI

12. 评论点赞
- 点赞 / 取消点赞接口
- `like_count` 原子更新
- 前端局部刷新

13. 歌单 CRUD
- 新增 `Playlist` 模型
- 创建、编辑、删除、排序
- 歌单详情页与整单播放

14. 用户个人主页
- 展示头像、昵称、简介、注册时间
- 展示上传曲目、评论历史等

15. 通知系统
- `Notification` 模型
- 评论回复 / 点赞等触发通知
- 顶部未读数与通知列表

### P2 体验与内容

16. 新 GUI 响应式规范落地
- 桌面三列统一
- 手机竖屏全屏播放视图
- 手机横屏紧凑播放器
- 断点与 JS 逻辑对齐

17. 统一歌词上传 / 校对体验
- 独立歌词上传页与音频上传页体验统一
- LRC/TXT 导入后的分列编辑能力
- 审查补充：独立歌词上传页保存源文件前已补 `source_file.seek(0)`；两处歌词编辑器 JS 已抽成共享模块

18. 歌词高亮优化
- 二分查找
- 用户手动滚动后的自动滚动暂停策略
- 移动端字体和 active 行细化

19. 音频元数据解析增强
- 更完整的后端元数据解析
- 自动读取时长 / 封面

20. 媒体文件生命周期管理
- 删除曲目或歌词时同步清理关联文件
- 清理孤儿媒体文件的管理命令

### P3 管理与审核

21. 管理后台增强
- Track / Album / Lyrics / Comment / Reaction / User 管理完善
- 审核、筛选、搜索、批量操作

22. 内容举报与审核流
- `Report` 模型
- 举报入口
- 后台审核流与敏感词初筛

### 文档

23. 文档持续维护
- 同步更新：
  - `docs/phase_3_user_auth.md`
  - `docs/handoff_frontend_backend.md`
  - `docs/frontend_dynamic_resources.md`
  - `docs/backend_handoff_2026_05_09.md`
  - `docs/database_integration.md`

## 当前建议执行顺序

1. 评论回复 UI + 评论点赞
2. 歌单 CRUD
3. 用户个人主页 + 通知系统
4. 新 GUI 响应式规范落地
5. 管理后台 + 举报审核
6. 播放队列登录用户维度持久化

## 最近一次验证

```text
python manage.py check
node --check static/js/echo-shell.js
node --check static/js/avatar-cropper.js
node --check static/js/lyrics-editor.js
python manage.py test tests
DJANGO_SETTINGS_MODULE=echo_project.settings.prod python -m django check
```

结果：
- Django check：通过
- JS 语法检查：通过
- 测试：45 / 45 通过
