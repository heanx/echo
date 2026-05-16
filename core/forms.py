from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm

from .avatar_processing import process_avatar_upload, validate_avatar_upload
from .models import AVATAR_PRESET_CHOICES, UserProfile


User = get_user_model()
PASSWORD_ALLOWED_SYMBOLS = "@.+-_!#$%^&*?"
PASSWORD_ALLOWED_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" + PASSWORD_ALLOWED_SYMBOLS


TEXT_FIELD_CLASS = (
    "w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm "
    "outline-none transition focus:border-brand dark:border-zinc-700 dark:bg-[#121212]"
)
FILE_FIELD_CLASS = (
    "w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm "
    "file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 "
    "file:text-sm file:font-bold file:text-white dark:border-zinc-700 dark:bg-[#121212]"
)
CHECKBOX_FIELD_CLASS = "h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand"


def _style_form_fields(fields):
    for field in fields.values():
        existing = field.widget.attrs.get("class", "")
        if isinstance(field.widget, forms.CheckboxInput):
            next_class = CHECKBOX_FIELD_CLASS
        elif isinstance(field.widget, forms.FileInput):
            next_class = FILE_FIELD_CLASS
        else:
            next_class = TEXT_FIELD_CLASS
        field.widget.attrs["class"] = (existing + " " + next_class).strip()


def validate_echo_password(password):
    if len(password) < 8:
        raise forms.ValidationError("密码不能低于 8 位。")
    if not any(char.isalpha() and char.isascii() for char in password):
        raise forms.ValidationError("密码必须包含至少 1 个英文字母。")
    if not any(char.isdigit() for char in password):
        raise forms.ValidationError("密码必须包含至少 1 个数字。")
    if any(char not in PASSWORD_ALLOWED_CHARS for char in password):
        raise forms.ValidationError("密码只能使用英文字母、数字和 @ . + - _ ! # $ % ^ & * ?")


class EchoAuthenticationForm(AuthenticationForm):
    username = forms.CharField(
        label="用户名",
        max_length=150,
        widget=forms.TextInput(attrs={"autocomplete": "username"}),
    )
    password = forms.CharField(
        label="密码",
        widget=forms.PasswordInput(attrs={"autocomplete": "current-password"}),
    )
    remember_me = forms.BooleanField(label="保持登录", required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        _style_form_fields(self.fields)


class EchoUserCreationForm(UserCreationForm):
    display_name = forms.CharField(
        label="昵称",
        max_length=120,
        required=False,
        help_text="显示在个人主页、评论和上传作品旁。可以先留空，系统会默认使用你的 ID。",
    )
    email = forms.EmailField(label="邮箱", required=False)
    avatar = forms.FileField(label="头像", required=False)
    avatar_preset = forms.ChoiceField(
        choices=[("", "不使用预设")] + AVATAR_PRESET_CHOICES,
        required=False,
        widget=forms.HiddenInput,
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("display_name", "username", "email", "avatar", "avatar_preset")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.order_fields(("display_name", "username", "email", "avatar", "avatar_preset", "password1", "password2"))
        self.fields["username"].label = "ID"
        self.fields["username"].help_text = "用于登录和个人主页地址，只能包含字母、数字和 @/./+/-/_。"
        self.fields["username"].widget.attrs["placeholder"] = "例如 flawless"
        self.fields["display_name"].widget.attrs["placeholder"] = "例如 Flawless"
        self.fields["email"].help_text = "可选，用于之后找回账号或接收通知。"
        self.fields["email"].widget.attrs["placeholder"] = "you@example.com"
        self.fields["username"].widget.attrs["autocomplete"] = "username"
        self.fields["email"].widget.attrs["autocomplete"] = "email"
        self.fields["avatar"].widget.attrs["accept"] = "image/jpeg,image/png,image/webp"
        self.fields["password1"].label = "密码"
        self.fields["password2"].label = "确认密码"
        self.fields["password1"].help_text = "不低于 8 位，必须同时包含英文字母和数字，可使用 @ . + - _ ! # $ % ^ & * ?"
        self.fields["password1"].widget.attrs["minlength"] = "8"
        self.fields["password1"].widget.attrs["pattern"] = r"(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@.+\-_!#$%^&*?]{8,}"
        self.fields["password1"].widget.attrs["data-password-rules"] = "true"
        self.fields["password1"].widget.attrs["class"] = (
            self.fields["password1"].widget.attrs.get("class", "") + " pr-12"
        ).strip()
        self.fields["password2"].widget.attrs["minlength"] = "8"
        self.fields["password2"].widget.attrs["class"] = (
            self.fields["password2"].widget.attrs.get("class", "") + " pr-12"
        ).strip()
        self.fields["password1"].widget.attrs["autocomplete"] = "new-password"
        self.fields["password2"].widget.attrs["autocomplete"] = "new-password"
        _style_form_fields(self.fields)

    def clean_email(self):
        email = self.cleaned_data.get("email", "").strip()
        if email and User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("这个邮箱已经被使用。")
        return email

    def clean_username(self):
        username = self.cleaned_data.get("username", "").strip()
        if username and User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError("这个 ID 已经被使用，请换一个。")
        return username

    def clean_avatar(self):
        avatar = self.cleaned_data.get("avatar")
        error = validate_avatar_upload(avatar)
        if error:
            raise forms.ValidationError(error)
        try:
            return process_avatar_upload(avatar)
        except Exception:
            raise forms.ValidationError("头像图片无法解析，请上传完整的 JPG、PNG 或 WEBP 图片。")

    def clean_password2(self):
        password1 = self.cleaned_data.get("password1")
        password = self.cleaned_data.get("password2")
        if not password:
            return password
        if password1 and password1 != password:
            raise forms.ValidationError("两次输入的密码不一致。")
        validate_echo_password(password)
        return password

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data.get("email", "")
        if commit:
            user.save()
            profile = user.profile
            profile.display_name = self.cleaned_data.get("display_name", "").strip() or user.username
            avatar = self.cleaned_data.get("avatar")
            if avatar:
                profile.avatar = avatar
                profile.avatar_preset = ""
            else:
                profile.avatar_preset = self.cleaned_data.get("avatar_preset", "")
            profile.save(update_fields=["display_name", "avatar", "avatar_preset"])
        return user


class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ("display_name", "avatar", "avatar_preset", "bio")
        labels = {"display_name": "昵称", "avatar": "头像", "bio": "简介"}
        widgets = {
            "avatar_preset": forms.HiddenInput(),
            "bio": forms.Textarea(attrs={"rows": 4}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["avatar"].widget = forms.FileInput()
        self.fields["avatar"].widget.attrs["accept"] = "image/jpeg,image/png,image/webp"
        _style_form_fields(self.fields)

    def clean_avatar(self):
        avatar = self.cleaned_data.get("avatar")
        error = validate_avatar_upload(avatar)
        if error:
            raise forms.ValidationError(error)
        try:
            return process_avatar_upload(avatar)
        except Exception:
            raise forms.ValidationError("头像图片无法解析，请上传完整的 JPG、PNG 或 WEBP 图片。")

    def save(self, commit=True):
        profile = super().save(commit=False)
        avatar = self.cleaned_data.get("avatar")
        if avatar:
            profile.avatar_preset = ""
        elif self.cleaned_data.get("avatar_preset"):
            profile.avatar = ""
        if commit:
            profile.save()
            self.save_m2m()
        return profile


class AccountSecurityForm(forms.Form):
    username = forms.CharField(
        label="ID",
        max_length=150,
        help_text="用于登录和个人主页地址，ID 不可重复。",
    )
    current_password = forms.CharField(
        label="当前密码",
        required=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "current-password"}),
        help_text="修改密码时需要填写当前密码。",
    )
    new_password1 = forms.CharField(
        label="新密码",
        required=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        help_text="不低于 8 位，必须同时包含英文字母和数字，可使用 @ . + - _ ! # $ % ^ & * ?",
    )
    new_password2 = forms.CharField(
        label="确认新密码",
        required=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
    )

    def __init__(self, *args, user, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = user
        self.fields["username"].initial = user.username
        self.fields["username"].widget.attrs["autocomplete"] = "username"
        self.fields["username"].widget.attrs["placeholder"] = "例如 flawless"
        self.fields["new_password1"].widget.attrs["minlength"] = "8"
        self.fields["new_password1"].widget.attrs["pattern"] = r"(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@.+\-_!#$%^&*?]{8,}"
        self.fields["new_password1"].widget.attrs["class"] = (
            self.fields["new_password1"].widget.attrs.get("class", "") + " pr-12"
        ).strip()
        self.fields["new_password2"].widget.attrs["minlength"] = "8"
        self.fields["new_password2"].widget.attrs["class"] = (
            self.fields["new_password2"].widget.attrs.get("class", "") + " pr-12"
        ).strip()
        _style_form_fields(self.fields)

    def clean_username(self):
        username = self.cleaned_data.get("username", "").strip()
        query = User.objects.filter(username__iexact=username).exclude(pk=self.user.pk)
        if username and query.exists():
            raise forms.ValidationError("这个 ID 已经被使用，请换一个。")
        return username

    def clean(self):
        cleaned = super().clean()
        current_password = cleaned.get("current_password", "")
        new_password1 = cleaned.get("new_password1", "")
        new_password2 = cleaned.get("new_password2", "")
        wants_password_change = bool(current_password or new_password1 or new_password2)
        if not wants_password_change:
            return cleaned
        if not current_password:
            self.add_error("current_password", "请先输入当前密码。")
        elif not self.user.check_password(current_password):
            self.add_error("current_password", "当前密码不正确。")
        if not new_password1:
            self.add_error("new_password1", "请输入新密码。")
        if not new_password2:
            self.add_error("new_password2", "请再次输入新密码。")
        if new_password1 and new_password2 and new_password1 != new_password2:
            self.add_error("new_password2", "两次输入的密码不一致。")
        if new_password1:
            try:
                validate_echo_password(new_password1)
            except forms.ValidationError as error:
                self.add_error("new_password1", error)
        return cleaned

    def save(self):
        username = self.cleaned_data.get("username", "").strip()
        password_changed = False
        if username and self.user.username != username:
            self.user.username = username
            self.user.save(update_fields=["username"])
        new_password = self.cleaned_data.get("new_password1", "")
        if new_password:
            self.user.set_password(new_password)
            self.user.save(update_fields=["password"])
            password_changed = True
        return self.user, password_changed
