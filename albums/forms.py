from django import forms
from django.core.files.uploadedfile import UploadedFile

from tracks.models import Track
from tracks.upload_validation import ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_SIZE, validate_upload_file

from .models import Playlist, PlaylistTrack


FIELD_CLASS = (
    "w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm outline-none "
    "transition focus:border-brand dark:border-zinc-700 dark:bg-[#121212]"
)
CHECKBOX_CLASS = "h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand"


def _style_fields(fields):
    for field in fields.values():
        if isinstance(field.widget, forms.CheckboxInput):
            field.widget.attrs["class"] = CHECKBOX_CLASS
        else:
            field.widget.attrs["class"] = (field.widget.attrs.get("class", "") + " " + FIELD_CLASS).strip()


class PlaylistForm(forms.ModelForm):
    class Meta:
        model = Playlist
        fields = ("title", "description", "visibility", "cover_image", "cover_theme")
        labels = {
            "title": "歌单名",
            "description": "简介",
            "visibility": "可见性",
            "cover_image": "封面图片",
            "cover_theme": "封面主题",
        }
        widgets = {
            "description": forms.Textarea(attrs={"rows": 4}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["title"].widget.attrs["placeholder"] = "例如 深夜循环"
        self.fields["visibility"].help_text = "公开歌单会展示在个人主页和歌单广场；私密歌单只有你自己可见。"
        self.fields["cover_image"].help_text = "支持 jpg、png、webp、gif，最大 8MB。"
        self.fields["cover_theme"].help_text = "没有自定义封面时使用的主题色。"
        _style_fields(self.fields)

    def clean_cover_image(self):
        cover_image = self.cleaned_data.get("cover_image")
        if not cover_image or not isinstance(cover_image, UploadedFile):
            return cover_image
        error = validate_upload_file(cover_image, ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_SIZE, "封面图片", "image")
        if error:
            raise forms.ValidationError(error)
        return cover_image


class PlaylistTrackForm(forms.ModelForm):
    class Meta:
        model = PlaylistTrack
        fields = ("track", "position")
        labels = {"track": "添加歌曲", "position": "排序"}

    def __init__(self, *args, playlist=None, **kwargs):
        super().__init__(*args, **kwargs)
        existing_ids = []
        if playlist and playlist.pk:
            existing_ids = playlist.playlist_tracks.values_list("track_id", flat=True)
        self.fields["track"].queryset = Track.objects.filter(status=Track.STATUS_PUBLISHED).exclude(pk__in=existing_ids)
        self.fields["position"].help_text = "数字越小越靠前。"
        _style_fields(self.fields)


class PlaylistBulkManageForm(forms.Form):
    selected_items = forms.ModelMultipleChoiceField(
        queryset=PlaylistTrack.objects.none(),
        required=False,
        widget=forms.CheckboxSelectMultiple,
        label="选中的歌曲",
    )
    action = forms.ChoiceField(
        choices=(("remove", "移除"), ("move_top", "移到顶部"), ("move_bottom", "移到底部")),
        label="操作",
    )

    def __init__(self, *args, playlist=None, **kwargs):
        super().__init__(*args, **kwargs)
        if playlist and playlist.pk:
            self.fields["selected_items"].queryset = playlist.playlist_tracks.all()
