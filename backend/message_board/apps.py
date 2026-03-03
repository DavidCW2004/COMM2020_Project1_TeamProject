import threading
import sys
from django.apps import AppConfig

class MessageBoardConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'message_board'

    def ready(self):
        if 'runserver' in sys.argv: #ensures the timer only starts when running the server, not during migrations or other management commands
            from .management.commands.agent_timer import Command
            
            def start_loop():
                cmd = Command()
                cmd.handle()

            thread = threading.Thread(target=start_loop, daemon=True) #ensures the thread will exist when the program finishes
            thread.start()