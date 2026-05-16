# Echo Phase 3 账户与资料系统

更新时间：2026-05-16

## 1. 阶段定位

Phase 3 account 的目标是把 Echo 的用户体系从“能登录”推进到“可展示、可编辑、可安全维护”的账户闭环。

本阶段覆盖：

- 注册、登录、退出。
- 用户资料卡片和个人主页。
- 头像上传、裁剪、系统预设头像。
- 昵称、ID、简介的职责拆分。
- 账户安全中心：修改 ID 和密码。
- 顶部全局设置菜单。

注意：账户下拉菜单不是账户资料设置菜单，而是全局设置菜单；个人资料编辑和账户安全应通过个人主页卡片或设置菜单进入。

## 2. 已落地能力

### 2.1 注册

注册页字段已经整理为更易理解的命名：

- `昵称`：展示给其他用户看的名称，可为空，默认回退到 ID。
- `ID`：登录名和个人主页地址的一部分，必须唯一。
- `邮箱`：可选，后续用于找回账号或通知。
- `头像`：支持上传图片或选择系统预设头像。
- `密码 / 确认密码`：实时提示一致或不一致。

密码规则：

- 不低于 8 位。
- 必须同时包含英文字母和数字。
- 允许字符：英文字母、数字、`@ . + - _ ! # $ % ^ & * ?`。
- 后端通过 `validate_echo_password()` 二次校验，不能只依赖前端提示。

ID 重复检测：

- 注册时 `EchoUserCreationForm.clean_username()` 会按 `username__iexact` 检查重复。
- 报错文案为：`这个 ID 已经被使用，请换一个。`

### 2.2 个人资料

个人资料编辑只负责“对外展示资料”：

- 昵称。
- 头像。
- 简介。

ID 和密码已经从资料编辑中拆出，不再放在 `UserProfileForm` 里修改。

个人主页本人资料卡片提供两个入口：

- `编辑资料`：进入 `/settings/profile/`。
- `账户安全中心`：进入 `/settings/security/`。

### 2.3 头像

头像来源支持两类：

- 上传头像文件：JPG / PNG / WEBP，最大 4MB。
- 系统预设头像：`pulse`、`dawn`、`mint`、`night`。

头像处理规则：

- 后端做文件头校验和图片解析，不能只看扩展名。
- 上传头像会经过 Pillow 解析与压缩。
- 数据库只保存媒体路径或预设头像 key。
- `UserProfile.avatar_url` 统一返回最终展示地址。

裁剪组件：

- 注册页和资料设置页共用 `templates/components/avatar_cropper.html`。
- 新上传图片可以拖动位置、缩放裁剪。
- 当前头像支持 `裁剪`、`保留`、`下载`。
- 选择系统预设头像时可以预览。

### 2.4 账户安全中心

账户安全中心位于：

```text
/settings/security/
```

使用表单：

```text
core.forms.AccountSecurityForm
```

负责：

- 修改 ID。
- 修改密码。
- 检查 ID 是否重复。
- 修改密码时校验当前密码。
- 修改密码后通过 `update_session_auth_hash()` 保持当前会话登录。

只修改 ID 时，密码字段可以留空。

密码修改需要同时提交：

- 当前密码。
- 新密码。
- 确认新密码。

## 3. 前端文件

账户相关前端主要入口：

```text
templates/auth/register.html
templates/profile/detail.html
templates/profile/settings.html
templates/profile/security.html
templates/components/avatar_cropper.html
templates/base.html
static/js/register-password-match.js
static/js/avatar-cropper.js
static/js/echo-shell.js
static/css/echo-shell.css
```

需要保留的 DOM / JS 约定：

- `[data-password-toggle]`：自定义密码可见性按钮。
- `[data-password-match]`：确认密码一致性实时提示。
- `[data-avatar-cropper]`：头像裁剪组件根节点。
- `[data-avatar-preset]`：系统预设头像按钮。
- `[data-avatar-crop-current]`：裁剪当前头像。
- `[data-avatar-keep-current]`：保留当前头像。
- `[data-avatar-download-current]`：下载当前头像。
- `[data-account-menu-trigger]`：顶部全局设置菜单触发按钮。

自定义密码小眼睛已经替代浏览器自带 reveal。CSS 中不要恢复原生 `::-ms-reveal` 显示，否则会再次出现两个眼睛。

## 4. 后端文件

核心后端文件：

```text
core/forms.py
core/models.py
core/views.py
core/urls.py
core/context_processors.py
core/avatar_processing.py
core/migrations/0002_userprofile_avatar_preset.py
```

关键类和函数：

- `EchoUserCreationForm`：注册表单。
- `UserProfileForm`：资料编辑表单。
- `AccountSecurityForm`：账户安全表单。
- `validate_echo_password()`：统一密码规则。
- `UserProfile.avatar_url`：统一头像展示地址。
- `profile_settings()`：资料编辑视图。
- `account_security()`：账户安全中心视图。

## 5. 数据库变更

`UserProfile` 当前字段：

```text
user
display_name
avatar
avatar_preset
bio
created_at
updated_at
```

其中：

- `avatar`：上传头像文件路径。
- `avatar_preset`：系统预设头像 key。
- `avatar_url`：模型属性，不落库。

新增迁移：

```text
core/migrations/0002_userprofile_avatar_preset.py
```

Django 内置 `auth.User.username` 继续作为 Echo 的 ID 使用，不新增重复的 ID 字段。

## 6. 路由

账户相关路由：

```text
/login/               -> core.views.login_view
/register/            -> core.views.register_view
/logout/              -> core.views.logout_view
/settings/profile/    -> core.views.profile_settings
/settings/security/   -> core.views.account_security
/users/<username>/    -> core.views.profile_view
```

模板中应优先使用 URL name：

```django
{% url 'profile_settings' %}
{% url 'account_security' %}
{% url 'profile' request.user.username %}
```

## 7. 测试覆盖

账户相关测试位于：

```text
tests/test_views.py
```

重点覆盖：

- 注册成功创建 `UserProfile` 并登录。
- 注册重复 ID 拦截。
- 注册头像文件校验。
- 注册系统预设头像。
- 注册密码长度、英文 + 数字、非法字符校验。
- 账户安全中心重复 ID 拦截。
- 账户安全中心修改 ID。
- 账户安全中心修改密码并保持登录。
- 当前密码错误时拒绝修改。
- 首页顶部设置菜单渲染。
- 个人主页 / 搜索结果优先展示上传头像。

## 8. 验证命令

```powershell
.\.venv\Scripts\python.exe manage.py check
```

```powershell
.\.venv\Scripts\python.exe manage.py test tests.test_views.AuthFlowTests tests.test_views.UserAvatarRenderingTests
```

```powershell
node --check static/js/register-password-match.js
node --check static/js/avatar-cropper.js
```

## 9. 后续建议

- 账户安全中心页面可补与注册页一致的实时密码一致性提示和自定义小眼睛。
- 顶部全局设置菜单中的“外观”“播放偏好”目前是产品入口占位，后续需要独立页面或弹窗。
- 后续如果支持找回密码，需要补邮箱验证状态和重置 token。
- 后续如果允许用户注销账号，需要定义媒体文件、评论、上传作品的归属处理策略。
