# echo 项目阶段开发文档：Django 前端入口与 PyCharm 工程整理

## 1. 阶段目标

本阶段的目标是为 `echo` 项目建立一个可以继续开发的 Django 工程底座，并完成一个满足当前技术栈方向的极简前端页面。

页面内容暂时只展示项目名：

```text
echo
```

同时，为了后续能在 PyCharm 中正常编辑、运行和识别 Django，本阶段还对项目文件结构和 Python 虚拟环境进行了整理。

## 2. 本阶段完成内容

### 2.1 创建 Django 项目基础结构

新增了标准 Django 项目结构：

```text
echo/
  manage.py
  echo_project/
    __init__.py
    settings.py
    urls.py
    asgi.py
    wsgi.py
  core/
    __init__.py
    apps.py
    urls.py
    views.py
  templates/
    core/
      home.html
```

其中：

- `echo_project/` 是 Django 项目的全局配置目录。
- `core/` 是当前阶段的主业务 app。
- `templates/core/home.html` 是首页模板。
- `manage.py` 是 Django 项目的命令入口。

这样做的原因是：Django 推荐将全局配置和业务 app 分离，结构清晰，后续添加音频上传、评论、播放统计等功能时不会混乱。

### 2.2 实现项目首页

首页路由为：

```text
/
```

对应视图：

```python
def home(request):
    return render(request, "core/home.html")
```

页面使用 Tailwind CDN 写了一个极简深色风格界面，当前只展示 `echo`。

这样做的原因是：当前需求只要求一个简单前端界面，但项目技术选型中明确包含 Tailwind CSS，因此页面先用 Tailwind 风格完成视觉基调，为后续音频卡片、播放器、评论区等 UI 扩展打基础。

### 2.3 配置 SQLite、模板、静态文件和媒体文件路径

在 `echo_project/settings.py` 中完成了基础配置：

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

STATIC_URL = "static/"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
```

这样做的原因是：SQLite 零配置、适合课程项目提交和演示；`MEDIA_ROOT` 后续会用于保存上传的音频文件和封面图。

### 2.4 整理 PyCharm 可识别的项目结构

最初项目根目录本身是一个虚拟环境目录，包含：

```text
Include/
Lib/
Scripts/
pyvenv.cfg
```

PyCharm 会根据这些文件判断该目录是 Python 虚拟环境，因此把项目源码误放到了“外部库”下面。

本阶段已将结构调整为：

```text
echo/
  .venv/           当前可用虚拟环境
  .venv_broken/    旧虚拟环境备份
  core/            Django app
  echo_project/    Django 项目配置
  templates/       页面模板
  tools/           辅助脚本
  manage.py
  README.md
```

这样做的原因是：正常的 PyCharm 工程应该是“项目源码在根目录，虚拟环境在 `.venv` 子目录”。这样 PyCharm 会把 `core`、`echo_project`、`templates` 当作项目源码，而不是外部库。

### 2.5 修复 Django 无法加载的问题

移动虚拟环境后，原解释器 `.venv\Scripts\python.exe` 仍然指向旧的 Python 路径，导致 PyCharm 无法导入 Django。

本阶段处理方式：

- 将坏掉的旧虚拟环境移动为 `.venv_broken`
- 重新创建可用的 `.venv`
- 将已有的 Django 运行依赖迁移到新 `.venv`
- 验证 `.venv\Scripts\python.exe` 可以正常导入 Django

验证命令：

```bat
.venv\Scripts\python.exe -c "import django; print(django.get_version())"
```

验证结果：

```text
5.2.13
```

这样做的原因是：PyCharm 需要一个真实可运行、能导入 Django 的解释器。只复制源码或只修改项目结构不够，解释器本身也必须可用。

### 2.6 新增开发启动脚本

新增：

```text
tools/run_dev_server.bat
```

内容为：

```bat
@echo off
cd /d "%~dp0.."
".venv\Scripts\python.exe" manage.py runserver 127.0.0.1:8000
```

这样做的原因是：脚本直接使用项目内 `.venv` 的 Python，不依赖系统 PATH，也不会误用 Conda 或其他 Python 环境。

## 3. 当前运行方式

在 PyCharm 终端或 Windows 命令行中进入项目根目录：

```bat
cd D:\Code\PythonProjects\echo
```

启动 Django 开发服务器：

```bat
tools\run_dev_server.bat
```

访问：

```text
http://127.0.0.1:8000/
```

## 4. PyCharm 配置方式

### 4.1 打开项目目录

PyCharm 应打开：

```text
D:\Code\PythonProjects\echo
```

不要打开 `.venv`，也不要打开 `.venv_broken`。

### 4.2 设置解释器

解释器选择：

```text
D:\Code\PythonProjects\echo\.venv\Scripts\python.exe
```

如果 PyCharm 仍显示找不到 Django，可以执行：

```text
File -> Invalidate Caches / Restart
```

然后重新选择解释器。

## 5. 当前验证结果

已执行 Django 项目检查：

```bat
.venv\Scripts\python.exe manage.py check
```

结果：

```text
System check identified no issues (0 silenced).
```

说明当前项目配置、路由和模板加载均正常。

## 6. 当前阶段文件变更总结

新增或调整的关键文件：

```text
manage.py
echo_project/settings.py
echo_project/urls.py
echo_project/asgi.py
echo_project/wsgi.py
core/apps.py
core/urls.py
core/views.py
templates/core/home.html
tools/run_dev_server.bat
README.md
.gitignore
docs/phase_1_frontend_setup.md
```

其中 `.gitignore` 已忽略：

```text
.venv/
.venv_broken/
__pycache__/
db.sqlite3
media/
staticfiles/
.idea/
```

这样做的原因是：虚拟环境、缓存、数据库运行文件和 IDE 配置不属于核心源码，不应该进入后续代码提交。

## 7. 下一阶段建议

下一阶段可以进入真正的 MVP 功能开发：

1. 创建 `AudioTrack` 模型。
2. 配置 `media/` 音频文件上传目录。
3. 编写音频上传表单。
4. 在首页展示音频列表。
5. 用 HTML 原生 `<audio>` 标签完成基础播放。

完成以上内容后，项目就能打通“上传 -> 数据库 -> 播放”的主流程。
