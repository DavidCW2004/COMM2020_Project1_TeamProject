from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views
from .views import ActivityViewSet

router = DefaultRouter()
router.register(r"activities", ActivityViewSet, basename="activities")

urlpatterns = [
    path("rooms/", views.rooms, name="rooms"),
    path("messages/", views.messages, name="messages"),
    path("rooms/<str:code>/", views.room_detail, name="room_detail"),
    path("rooms/<str:code>/members/", views.room_members, name="room_members"),
] + router.urls
