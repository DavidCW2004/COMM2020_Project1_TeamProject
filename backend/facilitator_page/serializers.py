from rest_framework import serializers
from message_board.models import Activity, Agent, SessionSummary

class FacilitatorActivitySerializer(serializers.ModelSerializer): # Serializer for the facilitators authoring interface
    class Meta:
        model = Activity
        fields = ['id', 'name', 'description', 'activity_type', 'phases', 'created_at']

class FacilitatorSummarySerializer(serializers.ModelSerializer): # Serializer so the facilitator can view session summaries
    activity_name = serializers.ReadOnlyField(source='activity.name')
    room_code = serializers.ReadOnlyField(source='room.code')

    class Meta:
        model = SessionSummary
        fields = [
            'id', 'room_code', 'activity_name', 'activity_run_id', 
            'participation_data', 'process_data', 'quality_data', 
            'extracted_content', 'created_at'
        ]


class FacilitatorAgentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Agent
        fields = ["id", "name", "description", "is_active"] #api needs to be exposed so that they can now be disabled
