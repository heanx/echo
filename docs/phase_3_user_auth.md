# Echo Phase 3 用户认证与资料系统

更新时间：2026-05-14

## 1. 阶段定位

Phase 3 的目标是把 Echo 从“匿名演示型音频社区”推进到“具备真实用户身份的轻量社区”。

本阶段重点不是复杂社交关系，而是先建立可靠的用户基础能力：

- 用户可以注册、登录、退出。
- 用户可以选择保持登录。
- 用户可以维护基础资料：显示名、头像、简介。
- 上传音乐和上传歌词需要登录。
- 上传作品会绑定到真实用户。
- 评论、回复、点赞等社区行为可以逐步绑定到真实账号。

这些能力是后续歌单、评论互动、通知系统、个人主页和内容审核的前置基础。

## 2. 当前落地状态

当前已经完成核心用户系统：

- Django 认证入口：
  - `/login/`
  - `/register/`
  - `/logout/`
  - `/settings/profile/`
  - `/users/<username>/`
- 用户资料模型：
  - `core.models.UserProfile`
  - 字段：`display_name`、`avatar`、`bio`
- 注册后自动创建用户资料。
- 旧用户缺失资料时，视图和上下文处理会兜底创建或安全降级。
- 顶部导航区已经区分匿名态和登录态。
- 匿名用户访问上传页会跳转到登录页。
- 上传音乐时写入 `Track.owner`。
- 登录页支持“保持登录”。
- 浏览器密码保存交给浏览器密码管理器，不在业务代码中保存明文密码。
- 注册页和资料设置页支持头像上传、预览、拖动裁剪、缩放、取消选择。
- 头像文件保存到媒体目录，数据库只保存文件路径。

## 3. 新增与变更文件

### 3.1 后端

```text
core/
  models.py              # UserProfile
  forms.py               # 登录、注册、资料表单
  avatar_processing.py   # 头像校验与压缩
  urls.py                # 用户相关路由
  views.py               # 登录、注册、退出、资料页、个人主页
  migrations/
    0001_initial.py      # UserProfile 表

tracks/
  models.py              # Track.owner
  migrations/
    0004_track_owner.py
  views.py               # 上传音乐要求登录，并绑定 owner

lyrics/
  views.py               # 上传歌词要求登录
```

### 3.2 前端模板

```text
templates/auth/
  login.html
  register.html

templates/profile/
  detail.html
  settings.html

templates/components/
  avatar_cropper.html

templates/base.html
```

### 3.3 静态资源

```text
static/js/avatar-cropper.js
static/css/echo-shell.css
```

## 4. 用户数据结构

### 4.1 UserProfile

`UserProfile` 与 Django 内置用户模型一对一绑定：

```python
class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=120, blank=True)
    avatar = models.FileField(upload_to="users/avatars/", blank=True, null=True)
    bio = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

说明：

- 不自定义替换 Django `User`，降低阶段风险。
- 用户登录、密码校验、session 管理由 Django 认证系统负责。
- 项目自有资料放在 `UserProfile`，方便后续扩展头像、简介、关注数、通知偏好等字段。

### 4.2 Track.owner

`Track` 新增 `owner` 字段：

```python
owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="tracks")
```

说明：

- 新上传作品会绑定当前登录用户。
- 老数据允许 `owner = NULL`，避免迁移破坏已有演示数据。
- 作者展示优先级为：用户资料显示名、用户全名、用户名、曲目 `artist`。

## 5. 登录注册流程

### 5.1 注册

入口：`GET /register/`

注册表单字段：

- 用户名
- 显示名
- 邮箱
- 头像
- 密码
- 确认密码

提交成功后：

1. 创建 Django 用户。
2. 自动创建或更新 `UserProfile`。
3. 保存显示名。
4. 如果上传头像，保存头像文件路径到 `UserProfile.avatar`。
5. 自动登录。
6. 跳转首页。

### 5.2 登录

入口：`GET /login/`

登录表单字段：

- 用户名
- 密码
- 保持登录

行为：

- 未勾选“保持登录”：session 在浏览器关闭后过期。
- 勾选“保持登录”：session 过期时间设置为 30 天。
- 密码保存不由项目实现，使用浏览器密码管理器；表单字段提供 `autocomplete="username"` 和 `autocomplete="current-password"`。

### 5.3 退出

入口：`/logout/`

退出后清理当前 session，并返回首页。

## 6. 头像上传设计

### 6.1 前端体验

注册页和资料设置页复用 `templates/components/avatar_cropper.html` 与 `static/js/avatar-cropper.js`。

支持：

- 只允许选择图片文件：`image/jpeg,image/png,image/webp`
- 选择后显示圆形预览
- 拖动图片调整裁剪位置
- 滑杆缩放
- 点击 `×` 取消已选文件
- 提交前将裁剪结果转为 `avatar.jpg`

前端裁剪只是体验增强，不作为安全边界。

### 6.2 后端校验

后端仍会执行：

- 扩展名校验：`.jpg`、`.jpeg`、`.png`、`.webp`
- 文件大小校验：最大 4MB
- 文件头魔数校验
- Pillow 图片解析
- 图片压缩与尺寸限制

压缩策略：

- 最长边限制为 512px
- 输出为 JPEG
- 质量参数为 82
- 保存到 `media/users/avatars/`

数据库只保存文件路径，不保存图片二进制。

## 7. 权限边界

当前已接入登录限制：

- `/tracks/upload/` 需要登录
- `/lyrics/upload/` 需要登录
- `/settings/profile/` 需要登录
- 创建评论需要登录
- 评论点赞需要登录

当前仍保持公开访问：

- 首页
- 曲目列表
- 曲目详情
- 歌词页
- 评论页
- 用户个人主页
- 搜索页

## 8. 测试覆盖

已补充相关回归测试：

- 注册后创建用户资料并自动登录。
- 登录支持 `next` 参数跳转。
- 未勾选保持登录时 session 随浏览器关闭过期。
- 勾选保持登录时 session 持久化。
- 注册可上传合法头像。
- 注册会拒绝伪装头像文件。
- 注册头像 input 限制图片 MIME。
- 匿名用户访问上传页会跳转登录。
- 登录用户上传曲目会写入 `Track.owner`。

当前验证命令：

```powershell
.\.venv\Scripts\python.exe manage.py check
node --check static\js\avatar-cropper.js
node --check static\js\lyrics-editor.js
.\.venv\Scripts\python.exe manage.py test tests
```

当前结果：45 个测试全部通过。

## 9. 当前限制与后续建议

### 9.1 当前限制

- 个人主页仍是基础版，只展示资料、上传作品和评论历史。
- 头像裁剪是轻量前端实现，不包含旋转、精细框选和移动端手势优化。
- 用户之间还没有关注、私信、通知等社交功能。
- 上传作品的编辑、删除和所有权校验还未完整产品化。

### 9.2 后续建议

建议下一步按这个顺序推进：

1. 完善个人主页统计：作品数、评论数、播放量汇总。
2. 增加“我的作品”管理页，支持编辑、隐藏、删除。
3. 评论回复和点赞全部绑定真实用户，并补通知。
4. 搜索结果页接入用户搜索和作品队列播放。
5. 后台增加 UserProfile、Track.owner、评论行为的筛选和审核能力。

## 10. 交接提示

后续开发用户相关功能时，建议遵守以下约定：

- 不直接把头像二进制写入数据库。
- 不自己保存明文密码或可逆加密密码。
- 权限判断优先基于 `request.user` 和对象所有权。
- 匿名用户只允许浏览公开内容，不允许产生写操作。
- 新增用户行为模型时，尽量显式保存 `user` 外键，避免继续使用纯文本用户名。
