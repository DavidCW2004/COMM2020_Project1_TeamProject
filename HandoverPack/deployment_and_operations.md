# Deployment And Operations

Date: 2026-03-11

## Deployment Scope

This document is for the project in its currrent state. It is primarily a development and coursework deployment guide and should not be used for production infrastructure.

## Technology Stack

Frontend:

- React 19
- TypeScript
- Vite
- React Router

Backend:

- Django
- Django REST Framework
- django-cors-headers
- WhiteNoise
- ReportLab

Database:

- PostgreSQL when `DB_HOST` is set
- SQLite fallback when database environment variables are not provided

## Default Application Routes

Backend routing:

- `/` home and auth-related pages
- `/api/` room, message, activity, summary, and final answer APIs
- `/api/facilitator/` facilitator and maintainer APIs
- `/admin/` Django admin

Frontend routes:

- `/` login page
- `/rooms` learner room hub
- `/room/:code` learner room dashboard
- `/facilitator` facilitator dashboard
- `/maintainer/activities` maintainer activities page

## Environment Variables

Backend variables used by the project:

```env
SECRET_KEY=<django secret>
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_NAME=postgres
DB_PASSWORD=12345
DB_SSLMODE=require
```

Frontend variable:

```env
VITE_API_BASE_URL=/
```

## Preferred Setup

This is a codespace oriented setup guide, codespaces is preferred over a local setup:

```bash
chmod +x setup_env.sh
source ./setup_env.sh
```

This script:

- installs backend requirements
- installs and starts PostgreSQL
- sets database environment variables
- runs migrations
- loads starter activity data
- creates the frontend `.env`

## Manual Local Setup

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py loaddata message_board/fixtures/activities.json
python manage.py runserver
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Example backend environment values used by the project:

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_NAME=postgres
DB_PASSWORD=12345
```

Frontend environment:

```env
VITE_API_BASE_URL=/
```

## Operational Workflow

Typical startup sequence:

1. Start the backend server from `backend/`
2. Start the frontend Vite server from `frontend/`
3. Set the frontend and backend ports to public
4. Open the frontend URL in the browser
5. Log in as learner, facilitator, or maintainer

## Operational Notes

### Authentication

- learners and facilitators are intended to use temporary accounts
- maintainers use username/password login
- backend auth endpoints are exposed in `backend/core/urls.py`

### Activities and Rooms

- activities are stored in the backend database
- rooms can select activities and can see the current phase
- activity running status is stored for each room
- posts and interventions are linked with a room and the activity run that was run
- activities can be customized with new phases and only certain agents being allowed
- rooms are linked to activities and also track the progression of each phase

### Maintainer Capabilities

Maintainers are the admins of the application. They have more permissions than facilitators. In the current implementation, maintainers can delete activities from the database and enable or disable agents globally, affecting all rooms.

### Summaries

Session summaries are stored and facilitators or maintainers can access summaries and export to PDF.


## Current Deployment Limitations

- deployment instructions are designed for local development and Codespaces, not for production hosting