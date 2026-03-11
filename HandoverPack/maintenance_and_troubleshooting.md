# Maintenance And Troubleshooting

Date: 2026-03-11

## Routine Maintenance

Recommended regular tasks:

- Check Python and Node dependencies against `requirements.txt` and `frontend/package.json`
- make sure to run backend migrations after any schema changes
- reload starter activity fixtures only when you are intentionally resetting seeded activity content
- Check the frontend API base URL is correct if the frontend origin changes
- review maintainer and facilitator perms after any authentication related changes

## Test And Verification

Backend automated tests are in `backend/message_board/tests/`.

Run tests:

```powershell
cd backend
pytest
```

Useful additional checks:

```powershell
cd frontend
npm run lint
npm run build
```

## Common Maintenance Tasks

### Apply database migrations

```powershell
cd backend
python manage.py migrate
```

### Reload starter activities

```powershell
cd backend
python manage.py loaddata message_board/fixtures/activities.json
```

### Run the Django development server

```powershell
cd backend
python manage.py runserver
```

### Run the frontend development server

```powershell
cd frontend
npm install
npm run dev
```

### Start the agent timer process

```powershell
cd backend
python manage.py agent_timer
```

### Reset rooms and users

This command deletes all rooms and non-superuser users:

```powershell
cd backend
python manage.py reset_rooms_users
```

Non-interactive usage:

```powershell
cd backend
python manage.py reset_rooms_users --yes
```

## Troubleshooting

### Backend does not connect to the database

Checks:

- confirm `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`, and `DB_PASSWORD`
- confirm PostgreSQL is running
- confirm the configured port matches the database service
- confirm SSL mode is appropriate for the environment
- make sure all ports are set to public

Important implementation detail:

- if `DB_HOST` is missing, Django will fall back on SQLite instead of using PostgreSQL

### Frontend cannot reach the backend

Checks:

- confirm the backend server is running
- confirm `VITE_API_BASE_URL` is there and correct
- confirm the frontend origin is allowed by CORS settings
- confirm CSRF trusted origins include the frontend URL in browser-based authenticated flows
- make sure ports are set to public

### Login or role-based navigation fails

Checks:

- confirm the user has their own `UserProfile`
- confirm `UserProfile.role` is set correctly
- confirm the frontend route is allowed using role checks

### Session summaries are missing

Checks:

- confirm the session produced posts tied to the current `activity_run_id`
- confirm summary generation endpoints were called
- confirm `SessionSummary` records do exist in the database

### PDF export fails

Checks:

- confirm `reportlab` is installed
- confirm the summary exists before export
- confirm summary JSON fields are structured correctly

### Automated interventions are not appearing

Checks:

- confirm the room has `activity_is_running=True`
- confirm relevant agents are active for the selected activity

## Known Risks And Gaps

- no documented monitoring, alerting, or backup system is included
- destructive cleanup commands exist and are only to be used when necessary