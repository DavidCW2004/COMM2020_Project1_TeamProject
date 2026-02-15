from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('', include('core.urls')),
    path('admin/', admin.site.urls),
    path('api/', include('message_board.urls')),
    path('api/facilitator/', include('facilitator_page.urls')),
]
