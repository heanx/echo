# Echo

Echo 是一个基于 Django 的轻量音频分享社区课程项目，当前已具备以下基础能力：

- 浏览与播放音频
- 上传音频与封面
- 歌词上传、解析与同步高亮
- 评论查看与提交
- 局部刷新主内容、常驻底部播放器
- 顺序 / 随机 / 循环播放模式
- 注册、登录、保持登录与用户资料
- 头像上传、文件名旁取消选择、预览拖动裁剪、压缩与格式校验
- 基础分页、错误页、空状态与上传安全校验
- Spotify 风格搜索页与顶部搜索建议
- `playQueue` 驱动的右侧播放列表与歌曲右键菜单

## 技术栈

- Django
- SQLite
- Tailwind CSS
- HTMX
- 原生 JavaScript

## 开发环境启动

```powershell
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

访问：

```text
http://127.0.0.1:8000/
```

## 配置结构

项目已拆分 Django settings：

- `echo_project.settings.base`
- `echo_project.settings.dev`
- `echo_project.settings.prod`

默认本地开发使用 `echo_project.settings.dev`。

## 阶段文档

- [Phase 1 前端入口与工程底座](docs/phase_1_frontend_setup.md)
- [Phase 2 评论与歌词数据设计](docs/phase_2_comments_lyrics.md)
- [Phase 3 用户认证与资料系统](docs/phase_3_user_auth.md)

生产配置至少需要这些环境变量：

- `ECHO_SECRET_KEY`
- `ECHO_ALLOWED_HOSTS`
- `ECHO_DATABASE_URL`

## 常用检查命令

```powershell
.\.venv\Scripts\python.exe manage.py check
node --check static\js\echo-shell.js
node --check static\js\avatar-cropper.js
node --check static\js\lyrics-editor.js
.\.venv\Scripts\python.exe manage.py test tests
```

## 当前状态

当前版本更偏“工程地基已逐步稳定、产品功能持续补全”的阶段。

已完成的关键工作包括：

- 中文乱码修复
- 基础回归测试
- 列表分页
- 全局错误处理与空状态
- 真实播放模式
- 真实播放队列状态
- 右侧播放列表已由 `playQueue` 驱动
- 搜索系统：独立 `/search/` 页、类型筛选、分页、相关性排序、顶部输入建议和搜索结果播放队列
- 用户注册、登录、退出和资料页
- 头像上传裁剪：文件名旁可取消，默认放大预览，支持拖动裁剪位置，不把图片二进制存入数据库
- 生产配置拆分
- 文件上传魔数校验
- 播放模式修复：单曲循环同步到原生 `audio.loop`，避免被播放队列重构影响
- 开发环境媒体 Range 响应：修复部分音频 seek 后回到 `0:00` 的问题
- 左侧音乐库 hover 让位动画：折叠按钮预偏移，标题 hover 时稳定右移让位
- 歌曲右键菜单：支持立即播放、下一首播放、加入/移出播放队列和查看歌曲
- 审查跟进：歌词源文件保存前回到文件开头、评论回复关系改为 `child_comments`、歌词编辑器 JS 抽成共享模块

下一步重点：

- 评论回复与评论点赞
- 歌单 CRUD
- 用户主页与通知系统
- 响应式 GUI 规范落地

## 编码规范

本项目统一使用 **UTF-8 without BOM** 编码。项目根目录 `.editorconfig` 已配置 `charset = utf-8`，请确保所使用的编辑器和 AI 工具遵循此规范。
