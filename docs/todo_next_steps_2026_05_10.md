# Echo Next Steps TODO

更新时间：2026-05-13

目标：把当前 Echo 从“可演示的课程原型”推进到“功能闭环更完整、工程地基更稳、可以继续迭代”的状态。

## 已完成

### P0 工程稳定

1. 中文乱码修复
- 状态：已完成（2026-05-10）

2. 基础后端回归测试
- 状态：已完成（2026-05-11）
- 当前结果：`tests/test_views.py` + `tests/test_error_urls.py` 共 35 个测试通过

3. 列表分页
- 状态：已完成（2026-05-11）
- 已覆盖：`/tracks/`、`/tracks/latest/`
- 待补：搜索结果落地后的分页联动

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

## 进行中

### 2026-05-14 审查跟进

本轮外部审查提出 5 个优先风险和 1 个可维护性隐患。当前工作区对照结果：

- 已覆盖：评论提交已限制 `Track.status = published`，隐藏 / 草稿 / 删除作品不能通过评论接口提交评论。
- 已覆盖：上传安全校验已从“只看扩展名”升级为扩展名、大小、文件头魔数校验；头像额外做图片解析和 Pillow 压缩。
- 已部分覆盖：顶部搜索框已提交到 `/search/` 独立搜索页，不再提交到 `/tracks/?q=`；搜索系统仍需补分页、队列入口和结果页体验。
- 待处理：`lyrics/views.py` 独立歌词上传读取 `source_file` 后应补 `source_file.seek(0)`，避免保存到 `FileField` 时文件指针停在 EOF。
- 待处理：`TrackComment.parent related_name="replies"` 与 `TrackComment.replies` property 命名冲突，应改为 `child_comments` / `reply_items` 等明确命名，并让模板使用 `reply_count` 或 `replies_count`。
- 待处理：`base.html`、`static/js/echo-shell.js` 继续变大，歌词编辑器逻辑在音频上传页和歌词上传页重复，建议抽成共享 JS 模块或小组件。

### P1 播放体验闭环

9. 真实播放队列模型
- 状态：核心完成，UI 收口待继续（2026-05-13）
- 已完成：
  - 前端维护 `playQueue`、`playQueueIndex`、`playQueueName`
  - 从首页推荐、最新、左侧最近播放、详情页、右侧播放列表等入口建立明确队列来源
  - 上一首、下一首、随机池、播放结束自动下一首改为基于真实队列
  - 队列状态本地持久化
- 待补：
  - 右侧播放列表改为完全由 `playQueue` 驱动渲染
  - 搜索结果和未来歌单页接入统一队列来源

## 待办

### P1 用户与社区

10. 搜索系统
- 支持按歌曲标题、歌手、专辑、上传者搜索
- 独立结果页
- 空状态和分页联动
- 搜索结果接入统一播放队列
- 审查补充：避免 `/tracks/?q=` 给用户造成“假搜索”印象；搜索入口统一到 `/search/`

11. 评论回复 UI
- 回复按钮
- 二级回复表单
- `parent` / `reply_to_user_name` 写入与展示
- 审查补充：先处理 `TrackComment.replies` 命名冲突，再继续扩展回复 UI

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
- 审查补充：独立歌词上传页保存源文件前补 `source_file.seek(0)`；两处歌词编辑器 JS 抽成共享模块

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
  - `docs/handoff_frontend_backend.md`
  - `docs/frontend_dynamic_resources.md`
  - `docs/backend_handoff_2026_05_09.md`
  - `docs/database_integration.md`

## 当前建议执行顺序

1. 搜索系统
2. 播放列表 UI 改为 `playQueue` 驱动
3. 评论回复 UI + 评论点赞
4. 歌单 CRUD
5. 用户个人主页 + 通知系统
6. 新 GUI 响应式规范落地
7. 管理后台 + 举报审核

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
- 测试：35 / 35 通过
