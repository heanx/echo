# Echo Next Steps TODO

更新时间：2026-05-16

目标：把 Echo 从“可演示的课程原型”推进到“功能闭环更完整、工程地基更稳定、可继续迭代”的状态。

## 已完成

### P0 工程稳定

1. 中文乱码修复
- 状态：已完成（2026-05-10）

2. 基础后端回归测试
- 状态：已完成（2026-05-11）
- 覆盖：视图、错误页、上传校验、评论、歌单、个人主页、通知等核心路径

3. 列表分页
- 状态：已完成（2026-05-11）
- 覆盖：`/tracks/`、`/tracks/latest/`
- 已补：搜索结果页歌曲列表分页

4. 全局错误处理与空状态
- 状态：已完成（2026-05-11）
- 覆盖：404、500、toast、播放器错误提示、空列表、空歌词、空评论等

5. 真实播放模式
- 状态：已完成（2026-05-13）
- 已支持：顺序、随机、列表循环、单曲循环、上一首、下一首、随机播放历史回退
- 已修复：单曲循环同步到原生 `audio.loop`，避免播放队列重构后循环失效

6. 真实播放队列模型
- 状态：已完成当前闭环（2026-05-18）
- 已完成：
  - 前端维护 `playQueue`、`playQueueIndex`、`playQueueName`
  - 首页推荐、最新、最近播放、详情页、右侧播放列表等入口可建立明确队列来源
  - 上一首、下一首、随机池、播放结束自动下一首改为基于真实队列
  - 队列状态本地持久化
  - 右侧播放列表完全由 `playQueue` 驱动渲染
  - 搜索结果和歌单详情页接入统一队列来源
  - 右侧播放列表显示队列来源、当前位置和总数

7. 生产环境配置拆分
- 状态：核心完成（2026-05-13）
- 已完成：
  - `echo_project.settings.base`
  - `echo_project.settings.dev`
  - `echo_project.settings.prod`
  - `manage.py` / `wsgi.py` / `asgi.py` 默认使用 `dev`
  - `prod` 下强制检查 `ECHO_SECRET_KEY`、`ECHO_ALLOWED_HOSTS`、`ECHO_DATABASE_URL`
- 待补：`requirements/prod.txt` 和更完整的部署说明

8. 文件上传安全校验
- 状态：已完成（2026-05-13）
- 已完成：
  - 音频、图片、歌词文件扩展名校验
  - 文件大小校验
  - 文件头魔数校验
  - 拒绝空文件和伪装文件
  - 头像额外做图片解析和 Pillow 压缩
- 已补回归测试：伪装音频、伪装图片、二进制歌词等

9. 真实用户登录系统
- 状态：核心完成（2026-05-13）
- 已完成：
  - Django 注册、登录、退出
  - `UserProfile` 资料表：显示名、头像、简介
  - 上传音乐、上传歌词要求登录
  - 上传作品绑定 `Track.owner`
  - 注册页和资料设置页支持头像上传、拖动裁剪、缩放、预览和格式校验
  - 登录页支持“保持登录”
  - 账户安全中心可修改 ID 和密码
  - 顶部账户下拉已调整为全局设置菜单

### P1 用户与社区

10. 搜索系统
- 状态：基础闭环已完成（2026-05-16）
- 已完成：
  - 顶部搜索入口统一提交到 `/search/`
  - 独立搜索结果页
  - 按歌曲标题、艺术家、专辑、上传者等字段搜索
  - 歌曲结果分页和空状态
  - 结果项保留 `data-play-queue="search-tracks"`，为统一播放队列接入做准备
- 待补：把搜索结果完整纳入 `playQueue` 渲染与右侧队列联动

11. 评论回复 UI
- 状态：基础闭环已完成（2026-05-16）
- 已完成：
  - 回复按钮
  - 二级回复表单
  - HTMX 局部插入
  - `parent` / `reply_to_user_name` 写入与展示
  - `child_comments` 预取
  - `reply_count` 计数

12. 评论点赞
- 状态：基础闭环已完成（2026-05-16）
- 已完成：
  - `TrackCommentReaction` 去重
  - 点赞 / 取消点赞接口
  - `F()` 原子更新 `like_count`
  - 前端 fetch 局部刷新数量和选中状态

13. 歌单 CRUD
- 状态：基础闭环已完成（2026-05-16）
- 已完成：
  - `Playlist` / `PlaylistTrack`
  - 公开 / 私有歌单
  - 创建、编辑、删除
  - 添加、移除歌曲
  - 歌曲排序
  - 歌单详情页和整单播放入口
- 待补：歌单封面上传、分享入口、右侧队列展示联动

14. 用户个人主页
- 状态：基础闭环已完成（2026-05-16）
- 已完成：
  - 头像、显示名、ID、简介、注册时间
  - 公开作品数、公开评论数
  - 上传曲目
  - 最近评论
  - 本人资料入口和账户安全入口
- 待补：用户公开歌单、收藏 / 喜欢记录、个人主页分页

15. 通知系统
- 状态：基础闭环已完成（2026-05-16）
- 已完成：
  - `Notification` 模型
  - 顶部未读数
  - 通知列表
  - 标记已读
  - 评论回复 / 评论点赞触发通知
- 待补：批量已读、通知偏好、更多通知类型

16. 媒体文件生命周期管理
- 状态：已完成当前闭环（2026-05-18）
- 已完成：
  - 删除 `Track` / `TrackLyrics` / `Album` / `UserProfile` 时清理对应上传文件
  - `cleanup_orphan_media` 管理命令，默认 dry-run，显式 `--delete` 才删除孤儿媒体文件
  - 替换 `Track.audio_file` / `Track.cover_image` / `TrackLyrics.source_file` / `Album.cover_image` / `UserProfile.avatar` 后清理旧文件

## 进行中

### 2026-05-14 审查跟进

本轮外部审查提出的优先风险已大多覆盖：

- 已覆盖：评论提交限制为 `Track.status = published`，隐藏 / 草稿 / 删除作品不能通过评论接口提交评论。
- 已覆盖：上传安全校验从“只看扩展名”升级为扩展名、大小、文件头魔数校验。
- 已覆盖：顶部搜索框提交到 `/search/` 独立搜索页，不再制造 `/tracks/?q=` 的“假搜索”入口。
- 已覆盖：`lyrics/views.py` 独立歌词上传读取 `source_file` 后执行 `source_file.seek(0)`。
- 已覆盖：`TrackComment.parent related_name="replies"` 与 `TrackComment.replies` property 命名冲突已处理，回复集合改为 `child_comments`。
- 待处理：`base.html` 和 `static/js/echo-shell.js` 继续变大，歌词编辑器逻辑在音频上传页和歌词上传页重复，建议抽成共享 JS 模块或小组件。

### 2026-05-18 项目审查跟进

本轮本地审查验证结果：`manage.py check` 通过，`manage.py test` 60 / 60 通过，`node --check static/js/echo-shell.js` 与 `node --check static/js/avatar-cropper.js` 通过。2026-05-18 已完成以下优先风险修复，并将测试扩充到 71 / 71 通过：

- 已处理：登录成功后的 `next` 参数使用 `url_has_allowed_host_and_scheme()` 校验本站来源，非法地址回退到首页。
- 已处理：`lyrics/views.py` 独立歌词上传不再使用 `Track.objects.all()[:50]` 暴露全部作品；下拉只展示公开作品，提交权限限制为公开作品、本人作品或管理员可见作品。
- 已处理：评论回复 parent 查询限制为公开评论；评论点赞同时校验评论状态和所属作品 `Track.status = published`。
- 已处理：替换头像、歌词源文件、音频文件、封面等文件时，保存成功后立即删除旧文件。
- 已处理：歌词 kind / lyrics_kind POST 值增加 `TrackLyrics.KIND_CHOICES` 白名单校验，非法值回退到 `original`。

## 待办

### P2 体验与内容

1. 新 GUI 响应式规范落地
- 桌面三列统一
- 手机竖屏全屏播放视图
- 手机横屏紧凑播放器
- 断点与 JS 逻辑对齐

2. 统一歌词上传 / 校对体验
- 独立歌词上传页与音频上传页体验统一
- LRC / TXT 导入后的分列编辑能力
- 两处歌词编辑器 JS 抽成共享模块

3. 歌词高亮优化
- 二分查找当前歌词行
- 用户手动滚动后的自动滚动暂停策略
- 移动端字体和 active 行细化

4. 音频元数据解析增强
- 后端自动读取时长
- 自动读取封面
- 自动读取艺术家、专辑等元数据

### P3 管理与审核

1. 管理后台增强
- Track / Album / Lyrics / Comment / Reaction / User 管理完善
- 审核、筛选、搜索、批量操作

2. 内容举报与审核流
- `Report` 模型
- 举报入口
- 后台审核流
- 敏感词初筛

### 文档

1. 文档持续维护
- 同步更新：
  - `docs/handoff_frontend_backend.md`
  - `docs/frontend_dynamic_resources.md`
  - `docs/phase_3_account.md`
  - `docs/backend_handoff_2026_05_09.md`
  - `docs/database_integration.md`

## 当前建议执行顺序

1. 抽离歌词编辑器共享 JS，顺手压缩 `base.html` / `echo-shell.js` 复杂度
2. 新 GUI 响应式规范落地
3. 歌词高亮体验优化
4. 音频元数据解析增强
5. 管理后台增强
6. 举报与审核流

## 最近一次验证

```text
python manage.py check
node --check static/js/echo-shell.js
node --check static/js/avatar-cropper.js
python manage.py test tests
DJANGO_SETTINGS_MODULE=echo_project.settings.prod python -m django check
```

结果：
- Django check：通过
- JS 语法检查：通过
- 测试：71 / 71 通过（2026-05-18）
