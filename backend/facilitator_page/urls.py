from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"activities", views.FacilitatorActivityViewSet, basename="facilitator-activities") # So facilitator can view and change activities

urlpatterns = [
    path("dashboard/", views.facilitator_dashboard_stats, name="facilitator_dashboard"), # Facilitators view of analytics    
    path("room/<str:room_code>/summary/", views.manage_session_summary, name="facilitator_manage_summary"), # Facilitators can manage session summaries
    path("room/<str:room_code>/summary/pdf/", views.export_facilitator_summary_pdf, name="facilitator_export_summary_pdf"),

] + router.urls