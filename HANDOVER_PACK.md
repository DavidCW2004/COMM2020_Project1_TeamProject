# Client Handover Pack

Date: 2026-03-09
Project: Social Study Teammates
Repository: `COMM2020_Project1_TeamProject`

## Purpose

This is the handover pack for the Social Study Teammates Project. It it used to help new clients or future maintainers understand what this project is and what is being delivered. It will also cover how to run the project and how to maintain the project after submission.

## Delivered Items

The project handover includes:

- Source code
- Frontend `frontend/`
- Backend `backend/`
- Project `setup_env.sh`
- Software inventory `SOFTWARE_INVENTORY.md`
- This handover pack `HANDOVER_PACK.md`

## System Overview

Social Study Teammates is a learning platform designed to promote more structured discussions, so that input is more equitable and discussions remain focused.

The platform provides:

- learner accounts for joining and participating in room activities
- facilitator access for creating new activities and watching over leaner sessions
- maintainer access for admin application management
- room-based collaboration workflows with chat feature
- activity phases so that discussion remains structured
- automatic summaries and PDF export for session review

## Repository Structure

- `frontend/`: React + TypeScript + Vite client
- `backend/`: Django + Django REST Framework server
- `backend/message_board/`: core collaboration models, logic and tests
- `backend/facilitator_page/`: facilitator and maintainer programs for management
- `backend/core/`: authentication and shared backend views
- `setup_env.sh`: Codespaces/Online setup helper
- `README.md`: project overview and quickstart
- `SOFTWARE_INVENTORY.md`: software/runtime/dependency inventory

## Technology Stack

Frontend:

- React
- TypeScript
- Vite
- React Router

Backend:

- Django
- Django REST Framework
- ReportLab

See `SOFTWARE_INVENTORY.md` for the versioned inventory.

## User Roles

The system currently supports three roles:

- `learner`: joins rooms, participates in activities by chatting in the rookm
- `facilitator`: creates new activities, monitors sessions
- `maintainer`: signs in with username/password and manages the entire application

Role handling is implemented through `UserProfile.role` in the backend.

Important access detail:

- learners and facilitators are always created as temporary accounts
- maintainers must use a username and password

### Creating a maintainer account

Maintainer accounts can be created using the Django shell:

```python
from django.contrib.auth.models import User
from message_board.models import UserProfile

u = User.objects.create_user(
    username="<maintainer_username>",
    password="<maintainer_password>"
)
u.first_name = "Maintainer"
u.save()

UserProfile.objects.update_or_create(
    user=u,
    defaults={"role": "maintainer"},
)
```

## Setup and Run

### Preferred setup

The repository includes a Codespaces-oriented setup script:

```bash
chmod +x setup_env.sh
source ./setup_env.sh
```

This script:

- installs backend requirements
- installs and starts PostgreSQL
- sets database environment variables
- runs migrations
- loads starter activity fixture data
- creates the frontend `.env`

### Manual local setup

Backend:

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py loaddata message_board/fixtures/activities.json
python manage.py runserver
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Example backend environment values used by the project:

```bash
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_NAME=postgres
DB_PASSWORD=12345
```

Frontend environment:

```bash
VITE_API_BASE_URL=/
```

## Operational Notes

### Activity and room management

- activities are stored in the backend and can be accessed and managed by facilitators and maintainers
- activities can be customized with new phases and only certain agents being active
- rooms link to activities and also track each phases progression

### Maintainer capabilities

Maintainers are the admins of the application. They have more permissions than facilitators. In our current implementation, maintainers can delete activities off the database and enable or disable agents globally, effecting all rooms.

### Summaries

Session summaries are stored and facilitator or maintainer can access summaries and export to PDF.

## Testing and Verification

Automated backend tests are located in:

- `backend/message_board/tests/`

Typical test run:

```bash
cd backend
pytest
```

## Data and Software Inventory

The project software inventory is stored separately in:

- `SOFTWARE_INVENTORY.md`

That is used for:

- runtime versions
- package dependencies
- installed app list

## Source Code Snapshot

TBA

## Known Handover Limitations

- deployment instructions are designed for local development and Codespaces, not for production hosting