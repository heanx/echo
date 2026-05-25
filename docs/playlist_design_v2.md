# Echo 歌单功能设计规范 V2

更新时间：2026-05-25

## 1. 设计目标

歌单功能用于帮助用户对音乐资源进行个性化组织、收藏、播放和分享。用户可以创建普通歌单，也可以通过系统默认的“我喜欢的音乐”歌单快速收藏歌曲。

本项目的歌单体验要服务于在线音乐网站的核心使用场景：用户在浏览、添加、排序、收藏和管理歌单时，不应中断底部播放器播放。因此，歌单相关操作优先使用 HTMX 局部刷新；只有创建页、完整编辑页、个人歌单中心等需要完整页面状态的入口才进行主内容区切换。

设计基准参考：

- Spotify 将 public/private 可见性与协作歌单能力分开描述，并提供私密分享、协作等不同访问能力。
- YouTube Music 将“邀请协作者”和“设置歌单隐私”作为不同操作。
- Apple Music 的协作歌单由所有者管理协作者、访问和权限，协作更接近权限关系，而不是第三种可见性。

## 2. 核心设计决策

### 2.1 可见性与协作分离

不要使用 `visibility = public/private/collaborative`。可见性只回答“谁能看”，协作只回答“谁能编辑”。一个歌单可以是“私密 + 邀请协作”，也可以是“公开 + 邀请协作”。

推荐字段：

```python
visibility = "public" | "private"
collaboration_mode = "none" | "invite"
```

课程设计 V1 只实现 `visibility` 即可，`collaboration_mode` 作为 V2 预留字段或后续迁移项。

### 2.2 默认歌单独立建模

“我喜欢的音乐”是系统默认歌单，不走普通歌单创建流程。它应在用户注册后自动创建，用于承载歌曲喜欢行为。

推荐字段：

```python
playlist_type = "normal" | "liked"
```

规则：

- `liked` 类型只能由系统创建。
- `liked` 歌单不可删除。
- `liked` 歌单不允许设置协作。
- 用户点击歌曲“喜欢”时，本质上是将歌曲加入默认喜欢歌单；取消喜欢时，从该歌单移除。

当前项目已有 `TrackLike` 表和 `/tracks/<id>/like/` 接口。后续重构时可以逐步迁移到默认 `liked` 歌单模型，或保留 `TrackLike` 作为兼容层，但最终产品概念应统一为“我喜欢的音乐”。

### 2.3 统计字段由后端维护

`track_count`、`play_count`、`favorite_count` 可以落表，但不能由前端直接写入。前端只发起行为请求，例如添加歌曲、播放歌单、收藏歌单；后端根据行为更新统计。

推荐规则：

- 添加歌曲成功后更新 `track_count`。
- 移除歌曲成功后更新 `track_count`。
- 播放歌单入口触发后更新 `play_count`。
- 收藏或取消收藏歌单后更新 `favorite_count`。
- 定期任务或管理命令可用于修正统计字段。

### 2.4 同一歌曲不可重复添加

同一首歌曲在同一个歌单中不允许重复出现。

后端必须保留唯一约束：

```python
UniqueConstraint(fields=["playlist", "track"], name="unique_playlist_track")
```

前端应在添加弹窗中显示“已在此歌单中”，避免用户反复提交；后端仍然以唯一约束作为最终防线。

## 3. 功能范围

| 功能模块 | 功能说明 | V1 是否实现 | 备注 |
| --- | --- | ---: | --- |
| 默认歌单 | 每个用户自动拥有“我喜欢的音乐” | 必做 | 不可删除 |
| 创建歌单 | 用户输入名称、简介、可见性创建歌单 | 必做 | 封面可上传或自动生成 |
| 编辑歌单 | 修改名称、简介、封面、公开状态 | 必做 | 仅创建者可编辑 |
| 删除歌单 | 删除普通歌单 | 必做 | 默认歌单不可删除 |
| 添加歌曲 | 将歌曲加入指定歌单 | 必做 | 禁止重复添加 |
| 移除歌曲 | 从歌单中移除歌曲 | 必做 | 不删除歌曲本体 |
| 播放全部 | 按歌单顺序播放所有歌曲 | 必做 | 接入底部播放器 |
| 调整顺序 | 上移、下移或拖拽排序 | 建议做 | V1 用上移 / 下移即可 |
| 收藏歌单 | 收藏他人公开歌单 | 建议做 | 增强社区属性 |
| 歌单广场 | 展示公开歌单 | 建议做 | 可放二期 |
| 协作歌单 | 邀请他人共同编辑歌单 | V2 | 作为扩展能力 |

## 4. 数据模型

### 4.1 Playlist

```python
class Playlist(models.Model):
    VISIBILITY_PUBLIC = "public"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, "公开"),
        (VISIBILITY_PRIVATE, "私密"),
    ]

    TYPE_NORMAL = "normal"
    TYPE_LIKED = "liked"
    PLAYLIST_TYPE_CHOICES = [
        (TYPE_NORMAL, "普通歌单"),
        (TYPE_LIKED, "我喜欢的音乐"),
    ]

    COLLABORATION_NONE = "none"
    COLLABORATION_INVITE = "invite"
    COLLABORATION_CHOICES = [
        (COLLABORATION_NONE, "不协作"),
        (COLLABORATION_INVITE, "邀请协作"),
    ]

    title = models.CharField(max_length=80)
    description = models.TextField(blank=True)
    cover_image = models.FileField(upload_to="playlists/covers/", blank=True, null=True)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_playlists")

    playlist_type = models.CharField(max_length=20, choices=PLAYLIST_TYPE_CHOICES, default=TYPE_NORMAL)
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    collaboration_mode = models.CharField(max_length=20, choices=COLLABORATION_CHOICES, default=COLLABORATION_NONE)

    track_count = models.PositiveIntegerField(default=0)
    play_count = models.PositiveIntegerField(default=0)
    favorite_count = models.PositiveIntegerField(default=0)
    is_deleted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

当前项目已按 V2 模型迁移：

- `Playlist.creator` 表示创建者。
- `Playlist.visibility` 表示公开 / 私密。
- `playlist_type`、`collaboration_mode`、`track_count`、`play_count`、`favorite_count`、`is_deleted` 已纳入模型设计。

### 4.2 PlaylistTrack

```python
class PlaylistTrack(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name="playlist_tracks")
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name="playlist_items")
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "added_at"]
        constraints = [
            models.UniqueConstraint(fields=["playlist", "track"], name="unique_playlist_track"),
        ]
```

不要直接使用普通 `ManyToManyField` 承载主要逻辑，因为歌单里的歌曲需要保存顺序、添加时间、添加者和后续协作审计信息。

### 4.3 PlaylistFavorite

```python
class PlaylistFavorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="favorite_playlists")
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name="favorites")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "playlist"], name="unique_playlist_favorite"),
        ]
```

用户收藏的是原歌单，不复制歌单。原歌单更新后，收藏者看到的内容同步更新。

### 4.4 PlaylistCollaborator

V2 预留：

```python
class PlaylistCollaborator(models.Model):
    ROLE_EDITOR = "editor"
    ROLE_VIEWER = "viewer"
    ROLE_CHOICES = [
        (ROLE_EDITOR, "可编辑"),
        (ROLE_VIEWER, "仅查看"),
    ]

    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name="collaborators")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="collaborative_playlists")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_EDITOR)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["playlist", "user"], name="unique_playlist_collaborator"),
        ]
```

协作者是否能移除别人添加的歌曲、是否能调整全部排序，应作为权限细则单独定义。

## 5. 权限规则

| 场景 | 游客 | 登录用户 | 创建者 | 协作者 |
| --- | ---: | ---: | ---: | ---: |
| 查看公开歌单 | 可以 | 可以 | 可以 | 可以 |
| 查看私密歌单 | 不可以 | 不可以 | 可以 | 视规则而定 |
| 创建歌单 | 不可以 | 可以 | 可以 | 可以 |
| 编辑歌单信息 | 不可以 | 不可以 | 可以 | 不可以 |
| 删除歌单 | 不可以 | 不可以 | 可以 | 不可以 |
| 添加歌曲 | 不可以 | 不可以 | 可以 | V2 可允许 |
| 移除歌曲 | 不可以 | 不可以 | 可以 | V2 可允许 |
| 收藏公开歌单 | 不可以 | 可以 | 可以 | 可以 |
| 删除“我喜欢的音乐” | 不可以 | 不可以 | 不可以 | 不可以 |

私密歌单不应出现在歌单广场、搜索结果、他人主页、推荐列表和未授权的侧边栏中。非创建者访问私密歌单时返回 404，避免暴露资源存在。

## 6. 路由与信息架构

### 6.1 个人歌单中心

根据当前产品定位，用户自己的歌单中心应挂在用户空间下：

```text
/users/<username>/playlist/
```

页面包含三个分区：

- `我的歌单`：固定第一位是系统默认“我喜欢的音乐”，后面展示当前用户创建的普通歌单。
- `收藏的歌单`：当前用户收藏的公开歌单或可见歌单。

他人访问 `/users/<username>/playlist/` 时：

- 只展示该用户公开普通歌单。
- 不展示该用户的“我喜欢的音乐”。
- 不展示私密歌单。
- 不展示仅当前登录用户可见的收藏列表，除非后续产品明确支持公开收藏。

当前已有 `/users/<username>/` 个人主页。建议新增 `/users/<username>/playlist/`，并从个人主页的“公开歌单”模块跳转到该歌单中心。

### 6.2 歌单详情与管理路由

推荐目标路由：

| 接口 | 方法 | 功能 |
| --- | ---: | --- |
| `/users/<username>/playlist/` | GET | 用户歌单中心 |
| `/users/<username>/playlist/` | GET | 个人歌单中心 |
| `/users/<username>/playlist/create/` | GET/POST | 创建歌单 |
| `/users/<username>/playlist/<id>/` | GET | 歌单详情 |
| `/users/<username>/playlist/<id>/edit/` | GET/POST | 编辑歌单 |
| `/users/<username>/playlist/<id>/delete/` | POST | 删除歌单 |
| `/users/<username>/playlist/<id>/tracks/add/` | POST | 添加歌曲到歌单 |
| `/users/<username>/playlist/<id>/tracks/<item_id>/remove/` | POST | 移除歌单歌曲 |
| `/users/<username>/playlist/<id>/tracks/<item_id>/reorder/` | POST | 调整歌曲顺序 |
| `/users/<username>/playlist/<id>/favorite/` | POST | 收藏或取消收藏歌单 |
| `/tracks/<id>/like/` | POST | 喜欢或取消喜欢歌曲 |
| `/tracks/<id>/add-to-playlist-panel/` | GET | 返回添加到歌单弹窗片段 |

当前项目已删除旧的 `/albums/playlists/` 和顶层 `/playlists/` 路由。歌单入口统一使用 `/users/<username>/playlist/`，`/albums/` 仅保留专辑相关页面。

## 7. 左侧音乐库规范

左侧音乐库中，“喜欢的音乐”下方必须出现两个子板块：

```text
音乐库
  全部 / 最新
  最近播放
  我的歌单
    我喜欢的音乐（置顶）
    深夜循环
    通勤节拍
    更多我的歌单
  收藏的歌单
    Echo 官方精选
    好友公开歌单
    更多收藏歌单
```

显示规则：

- 未登录用户：显示“喜欢的音乐”登录引导，不显示私有数据。
- 登录用户：显示“我的歌单”“收藏的歌单”，其中“喜欢的音乐”固定作为“我的歌单”的第一项。
- “我的歌单”最多显示最近更新的 5 个，点击“更多”进入 `/users/<username>/playlist/`。
- “收藏的歌单”最多显示最近收藏的 5 个。
- 空状态不应占用过多空间，只显示短句和创建/发现入口。

交互规则：

- 点击左侧歌单进入主内容区，不重载播放器。
- 通过 HTMX 切换主内容区时保留当前播放队列。
- 歌单详情页的“播放全部”写入底部播放器队列和右侧播放列表。

## 8. 核心业务流程

### 8.1 注册后默认歌单

```python
Playlist.objects.create(
    creator=user,
    title="我喜欢的音乐",
    playlist_type="liked",
    visibility="private",
)
```

建议通过 `post_save(User)` 信号或注册流程显式创建。需要保证幂等，避免重复默认歌单。

### 8.2 添加歌曲到普通歌单

```text
点击添加到歌单
-> 请求添加到歌单面板
-> 选择目标歌单
-> 后端校验登录状态、编辑权限、歌曲可见性
-> 后端校验是否重复
-> 创建 PlaylistTrack
-> 更新 track_count
-> 返回局部成功状态或 toast
```

### 8.3 播放歌单

```text
点击播放全部
-> 按 position, added_at 读取歌曲
-> 过滤不可播放或未发布歌曲
-> 写入底部播放器队列
-> 从第一首开始播放
-> 更新 play_count
```

### 8.4 删除歌单

普通歌单建议软删除：

```python
playlist.is_deleted = True
playlist.save(update_fields=["is_deleted", "updated_at"])
```

删除规则：

- `playlist_type="liked"` 不允许删除。
- 删除普通歌单后隐藏其收藏关系。
- 删除歌单不删除歌曲本体。
- 管理命令可清理长期软删除数据。

## 9. HTMX 交互规范

添加到歌单入口：

```html
<button
  hx-get="/tracks/{{ track.id }}/add-to-playlist-panel/"
  hx-target="#modal-root"
  hx-swap="innerHTML">
  添加到歌单
</button>
```

选择目标歌单：

```html
<button
  hx-post="/users/{{ playlist.creator.username }}/playlist/{{ playlist.id }}/tracks/add/"
  hx-vals='{"track_id": "{{ track.id }}"}'
  hx-target="#toast-root"
  hx-swap="innerHTML">
  {{ playlist.title }}
</button>
```

移除歌单歌曲：

```html
<button
  hx-post="/users/{{ playlist.creator.username }}/playlist/{{ playlist.id }}/tracks/{{ item.id }}/remove/"
  hx-target="#playlist-track-list"
  hx-swap="outerHTML">
  移除
</button>
```

收藏歌单：

```html
<button
  hx-post="/users/{{ playlist.creator.username }}/playlist/{{ playlist.id }}/favorite/"
  hx-target="#playlist-favorite-button"
  hx-swap="outerHTML">
  收藏歌单
</button>
```

喜欢歌曲：

```html
<button
  hx-post="/tracks/{{ track.id }}/like/"
  hx-target="#like-button-{{ track.id }}"
  hx-swap="outerHTML">
  喜欢
</button>
```

## 10. 页面规范

### 10.1 歌单列表页

个人歌单中心展示：

- 默认歌单“我喜欢的音乐”，固定第一位。
- 我的歌单，按 `updated_at` 倒序。
- 收藏的歌单，按收藏时间倒序。

歌单卡片元素：

- 封面。
- 标题。
- 作者或创建者。
- 歌曲数量。
- 可见性状态，仅在本人视角显示。
- 收藏状态，仅在他人公开歌单视角显示。

### 10.2 歌单详情页

详情页采用音乐产品常见结构：

- 上方：封面、标题、作者、歌曲数量、公开状态、播放全部按钮。
- 创建者视角：编辑、删除、添加歌曲、排序、批量管理。
- 他人公开歌单视角：播放全部、收藏/取消收藏。
- 下方：歌曲列表。

歌曲列表字段：

- 序号。
- 歌曲名。
- 歌手。
- 时长。
- 添加时间。
- 更多操作。

V1 排序建议使用“上移 / 下移”，比数字输入更直观。拖拽排序可作为后续增强。

### 10.3 移动端

移动端不照搬桌面三栏布局：

- 歌单列表进入“我的”或“音乐库”单栏页面。
- 歌单详情页保持单栏。
- 底部播放器固定显示。
- 歌单歌曲操作通过底部抽屉或轻量弹层完成。

## 11. 异常处理

必须覆盖：

- 未登录用户点击创建歌单时跳转登录。
- 添加重复歌曲时提示“已在此歌单中”。
- 歌单为空时显示空状态。
- 歌曲被隐藏、删除或不可播放时，在歌单中显示“歌曲不可用”。
- 非创建者访问私密歌单时返回 404。
- 私密歌单不进入歌单广场、他人主页、搜索和推荐。
- 删除普通歌单时隐藏收藏关系。
- 删除歌曲不影响其他歌单中的同一首歌曲。
- 默认“我喜欢的音乐”不可删除。
- 前端传入统计字段时后端忽略。

## 12. 当前项目落地差距

已具备：

- `Playlist` / `PlaylistTrack` 基础模型。
- 歌单创建、编辑、删除、添加、移除、排序。
- 歌单封面上传和替换清理。
- `PlaylistTrack` 唯一约束。
- 详情页播放队列接入。

已按本规范落地：

- `is_public` 已升级为 `visibility`。
- 已新增 `playlist_type`，并为用户自动创建默认“我喜欢的音乐”歌单。
- 已新增 `PlaylistFavorite`。
- 已新增 `/users/<username>/playlist/` 个人歌单中心。
- 左侧音乐库已增加“我的歌单”和“收藏的歌单”。

仍需继续打磨：

- 添加到歌单弹窗改为 HTMX 局部刷新。
- 排序体验从数字输入升级为上移 / 下移，后续再做拖拽。
- 更完整的歌单播放统计和收藏统计展示。

## 13. 推荐结论

本系统的歌单功能采用“普通歌单 + 默认收藏歌单”的双层设计。普通歌单用于用户自定义组织音乐资源，“我喜欢的音乐”作为系统默认歌单用于承载用户的快速收藏行为。歌单可见性采用 public/private 二元模型，协作能力作为独立权限模型预留扩展，避免将“可见性”和“编辑权限”混淆。

系统通过 `PlaylistTrack` 中间表维护歌单与歌曲之间的关系，并记录歌曲顺序、添加时间和添加者信息。所有统计字段由后端根据用户行为自动维护，前端不得直接写入。结合 HTMX 局部刷新机制，用户可以在不中断底部播放器的情况下完成添加歌曲、收藏歌单、移除歌曲等操作，从而形成接近单页应用的在线音乐体验。

## 14. 参考资料

- Spotify Support: Playlist privacy and access  
  https://support.spotify.com/us/article/playlist-privacy-and-access/
- YouTube Music Help: Make or edit a playlist  
  https://support.google.com/youtubemusic/answer/7205933
- Apple Support: Collaborate on a playlist in Music on iPhone  
  https://support.apple.com/guide/iphone/collaborate-on-a-playlist-iphcbe62053f/ios
