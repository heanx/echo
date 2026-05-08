# Echo Phase 1 前端入口与工程底座文档

更新时间：2026-05-07

补充说明：2026-05-08 已进入 Phase 2 评论与歌词设计阶段。评论/歌词数据结构详见 `docs/phase_2_comments_lyrics.md`，当前 Phase 1 文档仅保留工程底座和前端壳约定。

## 1. 阶段定位

Phase 1 的目标已经从“只显示 echo 项目名的极简首页”，演进为：

- 建立可继续开发的 Django 工程底座。
- 提供统一的 Spotify 风格前端壳。
- 保留顶部栏、三栏布局、底部播放器等核心 UI 骨架。
- 为后续音频上传、播放、评论、专辑等业务模块预留模板接口。

当前页面不是最终成品，但已经具备后续前后端继续接入的基础结构。

## 2. 当前工程结构

关键目录如下：

```text
echo/
  manage.py
  echo_project/
    settings.py
    urls.py
    asgi.py
    wsgi.py
  core/
    views.py
    urls.py
  tracks/
    models.py
    views.py
    urls.py
    management/commands/seed_demo.py
  albums/
    models.py
    views.py
    urls.py
  templates/
    base.html
    core/home.html
    core/lyrics.html
    core/comments.html
    components/
      track_card.html
      track_row.html
      album_card.html
    tracks/
      list.html
      detail.html
      upload.html
    albums/
      list.html
  tools/
    run_dev_server.bat
  docs/
    phase_1_frontend_setup.md
    handoff_frontend_backend.md
    frontend_dynamic_resources.md
    phase_2_comments_lyrics.md
```

## 3. Phase 1 已完成内容

### 3.1 Django 基础项目

已完成：

- Django 项目配置目录：`echo_project/`
- 基础业务 app：`core/`
- 音频业务 app：`tracks/`
- 专辑业务 app：`albums/`
- SQLite 数据库配置
- 模板目录配置
- 静态文件与媒体文件基础路径配置

当前 `settings.py` 已包含：

- `core`
- `tracks`
- `albums`

并配置了：

```python
STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
```

## 4. 当前前端入口

### 4.1 base.html

`templates/base.html` 是当前最重要的前端入口。

它负责：

- 页面 HTML 基础结构。
- Tailwind CDN 配置。
- 全局颜色、封面渐变类、滚动条样式。
- 顶部栏。
- 左侧音乐库。
- 中部 `#main-content` 容器。
- 右侧播放上下文栏。
- 底部常驻播放器。
- 播放器和布局状态 JavaScript。

注意：`#main-content` 由 `base.html` 提供，子页面不应该再定义同名 `<main>`。

### 4.2 home.html

`templates/core/home.html` 只负责首页内部 section 内容。

它使用这些后端变量：

- `display_name`
- `hero_track`
- `recommended_tracks`
- `latest_tracks`
- `hot_albums`

首页包含：

- Hero 推荐区
- 为你推荐
- 最新动态
- 热门专辑与单曲

## 5. 当前视觉与交互规范

当前采用 Spotify 风格：

- 深色优先。
- 黑色外层背景。
- 圆角面板。
- 左中右三栏。
- 底部播放器常驻。
- 绿色用于播放状态。
- 靛蓝色用于品牌主操作。

需要保留的视觉类：

```text
cover-summer
cover-city
cover-eclipse
cover-sea
cover-ocean
cover-signal
cover-sunset
cover-forest
cover-night
waveform
echo-scrollbar
bg-brand
text-play
```

## 6. 播放器接口

所有可以播放的按钮或卡片需要保留：

```html
data-echo-track
data-src="{{ track.audio_url|default:'' }}"
data-id="{{ track.id }}"
data-title="{{ track.title|escape }}"
data-artist="{{ track.artist|default:'Echo 用户'|escape }}"
data-cover="{{ track.cover_theme|default:'summer' }}"
```

`base.html` 中的 JavaScript 会监听 `[data-echo-track]` 点击，并更新底部播放器与右侧栏。

## 7. 当前路由

核心路由：

```text
/                         -> core:home
/lyrics/                  -> core:lyrics
/comments/                -> core:comments
/tracks/                  -> tracks:list
/tracks/latest/           -> tracks:latest
/tracks/upload/           -> tracks:upload
/tracks/<pk>/             -> tracks:detail
/albums/                  -> albums:list
```

模板中应使用 Django URL 标签：

```django
{% url 'tracks:list' %}
{% url 'tracks:latest' %}
{% url 'tracks:upload' %}
{% url 'tracks:detail' track.id %}
{% url 'albums:list' %}
{% url 'lyrics' %}
{% url 'comments' %}
```

不要再使用 `href="#xxx"` 作为主要页面跳转。

## 8. PyCharm 与运行方式

推荐打开项目目录：

```text
D:\Code\PythonProjects\echo
```

解释器：

```text
D:\Code\PythonProjects\echo\.venv\Scripts\python.exe
```

启动开发服务器：

```bat
tools\run_dev_server.bat
```

访问：

```text
http://127.0.0.1:8000/
```

## 9. 验证命令

基础检查：

```powershell
.\.venv\Scripts\python.exe manage.py check
```

页面渲染检查：

```powershell
@'
from django.test import Client
c = Client()
for path in ["/", "/tracks/", "/tracks/latest/", "/albums/"]:
    r = c.get(path, HTTP_HOST="127.0.0.1")
    print(path, r.status_code, "main-content" in r.content.decode(errors="ignore"))
'@ | .\.venv\Scripts\python.exe manage.py shell
```

预期：

```text
System check identified no issues
所有页面返回 200
页面 HTML 中包含 main-content
```

## 10. 后续建议

Phase 1 之后建议继续推进：

1. 修复所有模板中的中文乱码，统一确保 UTF-8 显示正常。
2. 为顶部栏补全全局 context processor：
   - `display_name`
   - `user_avatar_url`
   - `unread_message_count`
   - `friend_request_count`
3. 将 `Track` 的播放量统计接入播放器点击事件。
4. 完善上传表单的文件大小、类型校验。
5. 按 `docs/phase_2_comments_lyrics.md` 增加评论和歌词模型。
6. 用 HTMX 改造评论提交、歌词切换和中部栏局部刷新。
7. 让 `tracks/list.html`、`tracks/detail.html`、`tracks/upload.html`、`albums/list.html` 的视觉进一步对齐首页。

## 11. 注意事项

- 不要随意覆盖 `tracks/` 和 `albums/` 的后端文件。
- 不要删除 `base.html` 中的 `#main-content`，它是 HTMX 和页面壳的核心锚点。
- 子模板不要重复定义 `<main id="main-content">`。
- 修改大文件前先看 `git diff`，避免误删整份模板。
- PowerShell 直接查看中文可能显示乱码，优先通过浏览器或 Django 渲染结果判断真实显示。
