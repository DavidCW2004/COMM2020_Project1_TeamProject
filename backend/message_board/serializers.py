from rest_framework import serializers
from .models import Post

class PostSerializer(serializers.ModelSerializer):
    # This automatically includes the username instead of just the user ID
    author_name = serializers.ReadOnlyField(source='author.username')
    room_code = serializers.ReadOnlyField(source='room.code')

    class Meta:
        model = Post
        fields = ['id', 'room', 'room_code', 'author', 'author_name', 'content', 'created_at']