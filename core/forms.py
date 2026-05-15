# -*- coding: utf-8 -*-
from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm

from .avatar_processing import process_avatar_upload, validate_avatar_upload
from .models import UserProfile


User = get_user_model()


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
    display_name = forms.CharField(label="显示名", max_length=120, required=False)
    email = forms.EmailField(label="邮箱", required=False)
    avatar = forms.FileField(label="头像", required=False)

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "display_name", "email", "avatar")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["username"].widget.attrs["autocomplete"] = "username"
        self.fields["email"].widget.attrs["autocomplete"] = "email"
        self.fields["avatar"].widget.attrs["accept"] = "image/jpeg,image/png,image/webp"
        self.fields["password1"].widget.attrs["autocomplete"] = "new-password"
        self.fields["password2"].widget.attrs["autocomplete"] = "new-password"
        _style_form_fields(self.fields)

    def clean_email(self):
        email = self.cleaned_data.get("email", "").strip()
        if email and User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("这个邮箱已经被使用。")
        return email

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
        user = super().save(commit=False)
        user.email = self.cleaned_data.get("email", "")
        if commit:
            user.save()
            profile = user.profile
            profile.display_name = self.cleaned_data.get("display_name", "").strip() or user.username
            avatar = self.cleaned_data.get("avatar")
            if avatar:
                profile.avatar = avatar
            profile.save(update_fields=["display_name", "avatar"])
        return user


class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ("display_name", "avatar", "bio")
        labels = {"display_name": "显示名", "avatar": "头像", "bio": "简介"}
        widgets = {
            "bio": forms.Textarea(attrs={"rows": 4}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
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
