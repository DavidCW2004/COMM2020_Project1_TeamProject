import time
from django.core.management.base import BaseCommand
from message_board.models import Room
from message_board.agent_rules import check_room_state_rules
from message_board.views import get_activity_state

class Command(BaseCommand):
    help = "Continuously runs state-based agent rules for all active rooms."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Agent Timer is running..."))
        
        while True:
            active_rooms = Room.objects.filter(activity_is_running=True) #only checks currently active rooms
            
            for room in active_rooms:
                state = get_activity_state(room)
                phase_index = state.get("phase_index")
                check_room_state_rules(room, phase_index=phase_index) #checks the room/phase rules for each active room
            
            time.sleep(45) #time chose at 45 seconds to balance consistent rule checking with server load, can be adjusted