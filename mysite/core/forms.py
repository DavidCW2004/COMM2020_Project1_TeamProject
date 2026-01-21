from django import forms

from .models import Message, Reply


class MessageForm(forms.ModelForm):
    author_name = forms.CharField(
        max_length=100,
        required=False,
        help_text="Optional if you are logged in.",
    )

    class Meta:
        model = Message
        fields = ["author_name", "title", "body"]


class ReplyForm(forms.ModelForm):
    author_name = forms.CharField(
        max_length=100,
        required=False,
        help_text="Optional if you are logged in.",
    )

    class Meta:
        model = Reply
        fields = ["author_name", "body"]
