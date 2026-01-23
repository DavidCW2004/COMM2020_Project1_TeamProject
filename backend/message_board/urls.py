from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PostViewSet, messages, rooms

router = DefaultRouter()
router.register(r'posts', PostViewSet)

urlpatterns = [
    path('rooms/', rooms, name='rooms'),
    path('messages/', messages, name='messages'),
    path('', include(router.urls)),
]