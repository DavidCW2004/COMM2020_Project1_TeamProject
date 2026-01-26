from django.urls import path
from . import views

urlpatterns = [
    path("rooms/", views.rooms, name="rooms"),
    path("messages/", views.messages, name="messages"),
    path("rooms/<str:code>/", views.room_detail, name="room_detail"),
    path("rooms/<str:code>/members/", views.room_members, name="room_members"),
]
