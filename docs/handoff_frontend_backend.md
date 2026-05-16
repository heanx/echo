# Echo 项目交接文档

更新时间：2026-05-11  
用途：当前对话上下文已接近上限，新对话请先读本文件，再读相关专题文档。

## 当前总体状态

Echo 已经从静态首页发展为 Django + SQLite 的音乐社区原型，包含：

- `tracks`：音频作品、上传、列表、详情。
- `albums`：专辑/合集。
- `comments`：评论模型、评论查询、评论提交 partial。
- `lyrics`：歌词版本、歌词行、歌词上传/解析。
- `core`：首页、评论主界面、歌词主界面、账户资料、页面壳数据。

截至 2026-05-16，当前版本已经达到“大作业初步可用”阶段：可以运行本地服务、查看音乐社区首页、注册登录、编辑资料、维护账户安全、上传音频、浏览音乐列表、进入歌词/评论页、播放音频、记录播放量，并通过基础回归测试。

前端是 Spotify 风格三栏应用壳：

- 顶部栏：左侧 Echo Logo，中间 Home + 搜索框，右侧主题、消息、好友、上传、用户菜单。
- 顶部用户菜单当前定位为全局设置菜单，资料编辑和账户安全中心从本人个人主页卡片进入。
- 左侧栏：音乐库，可折叠；创建菜单包含上传音乐、歌单、共享合辑、文件夹、上传歌词。
- 中部栏：`#main-content`，首页、歌词页、评论页都在这里切换。
- 右侧栏：当前播放上下文；关闭按钮动态出现，标题 hover 右移让位。
- 底部栏：常驻播放器；歌词/评论按钮通过 HTMX 切换中部主内容。

## 当前已落地的后端能力

已存在 app：

```text
tracks/
albums/
comments/
lyrics/
core/
```

评论：

- `comments.models.TrackComment`
- `comments.models.TrackCommentReaction`
- `comments.queries.get_comment_page_context()`
- `comments.views.create_comment()`
- 路由：
  - `/comments/`
  - `/comments/<track_id>/create/`

歌词：

- `lyrics.models.TrackLyrics`
- `lyrics.models.TrackLyricLine`
- `lyrics.views.upload_lyrics()`
- 支持 LRC/纯文本上传解析。
- 路由：
  - `/lyrics/`
  - `/lyrics/upload/`

数据库/并发：

- `core/db.py` 和 `core/apps.py` 为 SQLite 开启 WAL、`busy_timeout` 等配置。
- 详细说明见 `docs/database_integration.md`。

账户与资料：

- `core.models.UserProfile` 保存昵称、头像、预设头像、简介。
- `core.forms.EchoUserCreationForm` 负责注册、ID 唯一性、密码规则、头像上传/预设头像。
- `core.forms.UserProfileForm` 只负责对外资料，不再修改 ID 和密码。
- `core.forms.AccountSecurityForm` 负责修改 ID 和密码。
- 路由：
  - `/settings/profile/`
  - `/settings/security/`
  - `/users/<username>/`

## 当前关键文档

请按优先级阅读：

1. `docs/handoff_frontend_backend.md`
   - 当前交接总览。
2. `docs/database_integration.md`
   - 当前真实数据库模型、关系、查询、接口、SQLite 注意事项。
3. `docs/backend_comments_lyrics_integration.md`
   - 评论/歌词后端落地说明。
4. `docs/phase_2_comments_lyrics.md`
   - Phase 2 原始数据设计文档。
5. `docs/phase_3_account.md`
   - Phase 3 账户、资料、头像和安全中心说明。
6. `docs/frontend_dynamic_resources.md`
   - 动态封面和响应式布局约定。
7. `docs/todo_next_steps_2026_05_10.md`
   - 当前 TODO、已完成项、新 GUI/登录/搜索/管理后台规划。
8. `docs/Echo 极简音频分享社区 GUI 设计规格说明书.md`
   - 新 GUI 响应式规范和可交互原型落地规则。
9. `docs/阶段说明书_2026_05_11.md`
   - 当前大作业阶段成果说明。
10. `docs/phase_1_frontend_setup.md`
   - 早期工程底座文档，仅作为背景参考。

## 重要文件

前端壳：

- `templates/base.html`
  - 风险最高文件。包含顶部栏、左右侧栏、播放器、HTMX 按钮、播放器 JS、顶部栏居中逻辑。

主内容模板：

- `templates/core/home.html`
- `templates/core/lyrics.html`
- `templates/core/comments.html`

评论模板：

- `templates/comments/comment_item.html`

歌词模板：

- `templates/lyrics/upload.html`

核心后端：

- `core/views.py`
  - `home()`、`lyrics()`、`comments()` 已接数据库查询。
  - `profile_settings()`、`account_security()` 负责资料和账户安全。
- `core/urls.py`
  - `/`、`/lyrics/`、`/comments/`、`/settings/profile/`、`/settings/security/`。
- `core/forms.py`
  - `EchoUserCreationForm`、`UserProfileForm`、`AccountSecurityForm`。
- `core/models.py`
  - `UserProfile` 与 `avatar_url`。
- `comments/models.py`
- `comments/queries.py`
- `comments/views.py`
- `comments/urls.py`
- `lyrics/models.py`
- `lyrics/views.py`
- `lyrics/urls.py`

## 前端交互约定

播放器触发元素必须保留：

```html
data-echo-track
data-src="{{ track.audio_url|default:'' }}"
data-id="{{ track.id }}"
data-title="{{ track.title|escape }}"
data-artist="{{ track.artist|default:'Echo 用户'|escape }}"
data-cover="{{ track.cover_theme|default:'summer' }}"
data-cover-url="{{ track.cover_url }}"
```

底部歌词/评论按钮：

- `#lyrics-nav`
- `#comments-nav`

JS 会在播放曲目变化时把它们的 `hx-get` 更新为：

```text
/lyrics/?track=<track_id>
/comments/?track=<track_id>
```

底部按钮点击时会优先使用当前播放器中的 `currentTrackId`，并通过 `loadMainResource()` 直接请求当前歌曲歌词或评论，避免页面 URL 仍停留在旧 track 时打开上一首内容。如果当前中部主内容已经是歌词/评论页，播放新歌时会自动刷新当前资源页。

首页导航：

- 顶部 Logo 和 Home 按钮带 `data-home-nav`。
- JS 函数 `window.EchoHome(event)` 会在返回首页前检查中部表单是否有未保存编辑内容。

布局状态使用 localStorage：

- `echo_theme`
- `echo_sidebar_collapsed`
- `echo_context_panel_open`
- `echo_player_volume`
- `echo_current_track_id`

## 最近刚改过的前端点

顶部栏：

- Logo 和 `Echo` 字号缩小；`Echo` 文案在 `sm` 以上显示，避免中等宽度过早消失。
- 顶部栏高度保持桌面一致，不再因为上传按钮/用户名隐藏而改变高度。
- Home + 搜索框作为一个搜索组。搜索框默认位于 header grid 中间列，宽度不足时自然缩小；`updateTopSearchLayout()` 会用 `--top-search-shift` 将搜索组连续平移到尽量接近顶部栏物理中心的位置，同时不覆盖 Logo/右侧按钮。
- 搜索组结构：
  - `.top-search-wrap`
  - `.top-search-cluster`
  - `#workspace-home-button`
  - `.top-search-balance`
- 顶部 tooltip 为同一水平行弹出：搜索组内 Home 向右弹，右侧按钮向左弹，避免跑到内容区下方或被遮挡。
- 注意：这个位置刚反复调整过，新对话如继续改，请优先用浏览器实际截图验证，不要只靠代码推断。不要恢复旧的绝对居中硬切 `.is-inline/.is-centered` 方案。

左侧音乐库：

- 标题文案为“音乐库”。
- 折叠状态点击音乐库 icon 可展开。
- 展开状态 hover 整个音乐库板块时，折叠按钮出现，音乐库 icon + 标题右移让位。
- 创建按钮为胶囊形“创建”，打开后变成关闭图标；当动态布局计算出的左栏宽度小于 `280px` 时进入 `.is-compact`，隐藏“创建”两个字，仅保留加号。
- 创建菜单支持亮/暗模式、icon hover 旋转放大并填充主题蓝。
- 折叠状态下创建菜单也能向右弹出。

响应式布局：

- 原先 `<1024px` 直接隐藏左侧音乐库、`<1280px` 直接隐藏右侧栏的硬断点已改为 JS 动态计算。
- `updateShellLayout()` 根据实际视口宽度设置：
  - `--left-width`
  - `--right-width`
  - `layout-has-left/layout-no-left`
  - `layout-has-context/layout-no-context`
- 当前策略：
  - `>= 760px` 保留左侧音乐库。
  - 手动折叠左侧栏时宽度为 `76px`。
  - 展开左侧栏宽度约为视口的 `22%`，限制在 `248px ~ 320px`。
  - 右侧播放上下文栏按空间动态显示，候选宽度约为视口的 `20%`，限制在 `248px ~ 360px`。
  - 当左栏和右栏都显示后中间内容不足约 `560px` 时，右栏自动隐藏。
  - 例如 `1000px` 宽：左栏约 `248px`，右栏隐藏，中间约 `752px`。

右侧栏：

- 关闭按钮在左侧，hover 右侧栏时出现。
- `正在播放` 标题 hover 时右移让位。
- 关闭按钮 tooltip 从按钮右侧弹出，并提高了层级避免被标题遮挡。

播放器：

- 播放状态色从绿色统一改为主题蓝 `#6366F1`。
- range `accent-color` 也是主题蓝。
- 底部播放器高度在非极窄状态保持桌面一致，不再随上传按钮/用户名等顶部状态变化。
- 进度条和音量条由 `updatePlaybackLayout()` 连续计算宽度：
  - `--player-progress-width` 根据 `.playback-controls` 实际宽度计算，范围 `128px ~ 520px`。
  - `--player-volume-width` 根据右侧工具区宽度计算，范围 `56px ~ 128px`。
  - 宽度变化带 `transition: width 180ms ease`，避免断点生硬跳变。
- `<=639px` 进入紧凑两行播放器布局：
  - 第一行：歌曲信息 + 核心播放控制。
  - 第二行：进度条横跨整条播放器。
  - 顶部搜索组隐藏 Home 圆钮，把空间让给搜索框。
- `<=420px` 时隐藏上一首/下一首，优先保留播放/暂停和进度条。
- 底部播放器按钮已补充同一水平行 tooltip：随机、上一首、播放/暂停、下一首、循环、歌词、评论、音量、播放队列、播放上下文。
- 2026-05-11 新 GUI 规范已记录在 TODO 和 GUI 规格文档中。后续播放栏需要统一桌面/竖屏/横屏断点，不要再单独凭局部 CSS 猜测右侧栏状态。

主内容：

- `/comments/` 和 `/lyrics/` 是中部主界面，不是右侧栏内容。
- 歌词背景为主题蓝。
- 歌词区已限制为约 2/3 宽度，长句自动换行；当前行不再放大，字体改为 Arial/Helvetica。
- 评论页已接数据库，支持筛选、提交、partial 插入。

测试：

- `tests/test_views.py` 已覆盖基础页面 200、播放量接口、评论 no-cache、歌词 track 解析、上传格式提示。
- 当前共有 18 个 Django 测试，最近一次运行全部通过。

## 已知风险

- `templates/base.html` 很大，且承载多个交互。修改前先 `git diff -- templates/base.html`。
- 顶部栏居中逻辑刚经历多轮改动，视觉目标是：宽度足够时 `Home + 搜索框` 尽量接近顶部栏物理中心；宽度受限时搜索框缩小/平移，不能和 Logo/右侧按钮重叠。
- 顶部和底部 tooltip 依赖 `overflow: visible`，不要为了解决高度问题把 `#top-bar` 或 `#playback-bar` 改回 `overflow: hidden`。
- 顶部/底部栏高度不应因为“上传按钮隐藏”这类中间宽度状态而改变；中间宽度只调整宽度和可见组件。
- 不要删除 `#main-content`，它必须只由 `base.html` 提供。
- 不要把歌词/评论放进右侧栏，它们是中部主界面。
- 新 GUI 断点尚未完整落地。播放栏居中、右侧栏显示、横屏模式必须作为同一个响应式任务处理。
- 不要随意清理未跟踪目录：当前很多 app/template/doc 文件仍显示为 untracked，是前几轮对话生成内容。
- PowerShell 查看中文请用 `Get-Content -Encoding UTF8`。

## 推荐验证命令

基础检查：

```powershell
.\.venv\Scripts\python.exe manage.py check
```

页面渲染：

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from django.test import Client; c=Client(); paths=['/','/lyrics/','/comments/','/tracks/','/tracks/latest/','/tracks/upload/','/albums/','/lyrics/upload/']; [print(path, (r:=c.get(path, HTTP_HOST='127.0.0.1')).status_code, 'main-content' in r.content.decode(errors='ignore')) for path in paths]"
```

评论相关快速检查：

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from comments.models import TrackComment; from lyrics.models import TrackLyrics; print('comments', TrackComment.objects.count()); print('lyrics', TrackLyrics.objects.count())"
```

启动本地服务：

```powershell
tools\run_dev_server.bat
```

访问：

```text
http://127.0.0.1:8000/
```

## 新对话建议优先级

1. 先运行验证命令，确认当前工作树能启动。
2. 打开浏览器检查顶部栏：宽屏、中屏、窄屏下 `Home + 搜索框` 是否尽量居中、连续平移且不重叠。
3. 检查底部播放器：宽屏、中屏、最窄宽度下进度条/音量条是否平滑变化，紧凑两行布局是否正常。
4. 检查左侧创建菜单：展开/折叠状态、紧凑宽度只显示加号、亮/暗模式、空间不足定位。
5. 检查 `/comments/`：
   - 筛选链接是否正常。
   - HTMX 发布评论是否插入 `#comments-list`。
6. 检查 `/lyrics/` 和 `/lyrics/upload/`：
   - 是否读取数据库歌词。
   - 上传 LRC/纯文本后是否生成行。
7. 后续功能：
   - 新 GUI 响应式规范完整落地。
   - 真实用户登录系统。
   - 搜索系统。
   - 管理后台。
   - 真实播放队列和播放模式。
   - 评论点赞接 `TrackCommentReaction`。
   - 评论回复接 `parent`。

## 2026-05-10 最新交接补充

本节覆盖旧章节里已经过时的“未落地”描述。后续接手时优先以这里为准。

### 播放器与全局 Track 状态

- `static/js/echo-shell.js` 维护 `currentTrackId`，并同步到 `localStorage.echo_current_track_id`。
- 所有 `[data-echo-track]` 元素点击都会调用 `playTrack(trackFromElement(...))`，再调用 `setCurrentTrack(track.id)`。
- `setCurrentTrack(trackId)` 会刷新底部 `#lyrics-nav`、`#comments-nav` 的 `hx-get` 和 `href`：

```text
/lyrics/?track=<track_id>
/comments/?track=<track_id>
```

- 底部歌词/评论按钮点击时，优先使用全局播放中的 `currentTrackId` / `localStorage.echo_current_track_id`，当前页面 URL 的 `track` 只作为兜底。这个修复避免页面停在 `track=12`、播放器播放 `track=10` 时，底部歌词/评论错误打开 `track=12`。
- 首次加载时如果 URL 带 `track`，优先选中 URL 对应歌曲；否则默认选中播放列表第一首并设置播放器 UI 和 `audio.src`，但不自动播放。没有播放列表时才使用 localStorage 兜底。

### 播放列表、上一首/下一首

- 右侧播放列表来源是 `#playlist-track-list .playlist-track[data-echo-track]` 当前 DOM 顺序。
- 上一首/下一首按钮通过 `#player-toggle` 的相邻元素定位。
- `playPlaylistOffset(offset)` 会按播放列表循环播放，末尾下一首回到第一首，第一首上一首回到最后一首。
- `audio ended` 事件会自动调用 `playPlaylistOffset(1)`。

### 进度条与歌词联动

- 进度条拖动分为 preview 和 commit：
  - `input` 阶段只更新当前时间显示和歌词高亮预览，不反复写 `audio.currentTime`。
  - `change` / `pointerup` 阶段才真正 seek。
- 拖动期间歌词不会自动 `scrollIntoView`，避免歌词页滚动打断 range 输入，导致 seek 回到 `0:00`。
- 歌词行支持点击跳转：点击 `.lyrics-line[data-start-ms]` 会把播放器跳到对应时间。
- 歌词高亮使用 `lyric-dist-0` 到 `lyric-dist-4` 和 `lyric-dist-far` 做距离样式。用户手动滚动歌词时，短时间内会抑制自动滚动。

### 评论、歌词资源刷新

- `refreshActiveResource(trackId)` 会在当前中部主内容为 `data-echo-resource="lyrics"` 或 `comments` 时，切歌后重新 fetch 对应页面并替换 `#main-content`。
- 自动刷新使用请求取消和版本号保护，避免旧请求晚返回覆盖新歌内容。
- 评论页由后端 `@never_cache` 禁用缓存，避免切歌或筛选时复用旧 HTML。
- 后续如继续改 HTMX 链接，务必保证底部歌词/评论按钮的 track 参数来自当前播放，不要重新改回“优先读当前页面 URL”。

### 上传与格式支持边界

- 当前音频上传支持：`.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.flac`, `.webm`。
- `.ncm` / `ncmdump` 支持已撤回，项目内没有打包 `ncmdump`，后端也没有 `NCMDUMP_BIN` 配置。
- 上传页仍保留普通音频元数据读取、时长预读、歌词分列编辑、歌词预听校对、封面预览等能力。

### 建议回归

1. 打开 `/lyrics/?track=12`。
2. 从音乐库或播放列表点击播放 `track=10`。
3. 确认右侧/底部显示 `track=10`。
4. 点击底部歌词、评论按钮。
5. 确认请求和页面都进入 `track=10`，不会回到 `track=12`。
