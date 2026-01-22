from rest_framework import serializers
from .models import Post

class PostSerializer(serializers.ModelSerializer):
    # This automatically includes the username instead of just the user ID
    author_name = serializers.ReadOnlyField(source='author.username')

    class Meta:
        model = Post
        fields = ['id', 'author', 'author_name', 'content', 'created_at']