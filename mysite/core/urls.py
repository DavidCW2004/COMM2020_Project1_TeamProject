from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("board/", views.message_list, name="message_list"),
    path("board/<int:message_id>/", views.message_detail, name="message_detail"),
]
