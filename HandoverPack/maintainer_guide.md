# Maintainer Guide

---

## 1. Introduction

This guide is for maintainers (developers) responsible for keeping the Social Study Teammates platform running, extending its functionality, and managing its content. It covers environment setup, how to add or modify agent rule and activities, how to run the test suite, and how to manage the database.

It assumes familiarity with Python, Django, and basic command-line usage. No prior knowledge of the codebase is assumed.
---

## 2. System Overview

The system consists of two main components:

- A Django REST API backend, serving data and running agent logic.
- A React (Vite + TypeScript) frontend, served separately.
- A PostgreSQL database, run inside GitHub Codespaces for development and demos.

Key directories a maintainer will work with:

| Path | Description |
|------|-------------|
| `backend/message_board/agents.py` | All agent rule logic — this is where rules are added or modified |
| `backend/message_board/fixtures/` | Fixture files including `activities.json` for seeded content |
| `backend/message_board/models.py` | Django data models (Post, Room, Agent, Intervention, etc.) |
| `backend/mysite/settings.py` | Django configuration including database, CORS, CSRF, and middleware |
| `backend/` | Django project root — `manage.py` lives here |
| `frontend/src/` | React frontend source code |
| `.env` | Environment variables (not committed to version control) |

---

## 3. Environment Setup

> **Codespaces (preferred):** If running in GitHub Codespaces, the environment setup script handles dependencies, migrations, and fixture loading automatically. Run the following before anything else:
> ```bash
> chmod +x setup_env.sh
> source ./setup_env.sh
> ```
> Then follow the instructions printed in the terminal to start the frontend and backend. Skip to section 3.5 if using this method.

### 3.1 Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (running inside Codespaces or locally)
- Git

### 3.2 Cloning and Installing Dependencies

Clone the repository and set up the backend virtual environment:

```bash
git clone <repository-url>
cd backend
python -m venv .venv
```

Activate the virtual environment:

- **Windows:** `.\.venv\Scripts\Activate.ps1`
- **macOS/Linux:** `source .venv/bin/activate`

Then install backend dependencies:

```bash
pip install -r requirements.txt
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

### 3.3 Environment Variables

Create a `.env` file in the `backend/` directory. The following variables are required:

| Variable | Description |
|----------|-------------|
| `DB_HOST` | Database host (e.g. `127.0.0.1` for local Codespaces) |
| `DB_PORT` | Database port (default: `5432`) |
| `DB_USER` | Database username (e.g. `postgres`) |
| `DB_NAME` | Database name (e.g. `postgres`) |
| `DB_PASSWORD` | Database password |
| `SECRET_KEY` | Django secret key — must be set to a strong unique value for any public-facing deployment. If not set, an insecure fallback is used (development only). |
| `DEBUG` | Set to `True` for development, `False` for production |
| `ALLOWED_HOSTS` | Comma-separated list of allowed hostnames |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated list of trusted origins (e.g. `https://*.devtunnels.ms`) |

For the frontend, create a `.env` file in the `frontend/` directory:

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Base URL for the Django API (use `/` if served from the same origin) |

> ⚠️ **Warning:** Never commit `.env` files to version control. The `SECRET_KEY` fallback in `settings.py` is insecure and must not be used in any deployment beyond local development.

### 3.4 Database Setup

Apply migrations and load the seeded fixture data:

```bash
cd backend
python manage.py migrate
python manage.py loaddata backend/message_board/fixtures/activities.json
```

> **Note:** If the Codespace is rebuilt, the database will be reset and you will need to re-run migrations and reload fixtures.

### 3.5 Running the Development Server

Start the Django backend:

```bash
cd backend
python manage.py runserver
```

In a separate terminal, start the frontend:

```bash
cd frontend
npm run dev
```

---

## 4. Adding a New Agent Rule

All agent logic lives in a single file:

```
backend/message_board/agents.py
```

There are two types of rules in the system:

- **Post rules** — triggered when a new message is submitted (e.g. rude message check, evidence check). These receive a `room` and a `post` object.
- **Room/phase rules** — triggered periodically against the room's current state (e.g. equity check, inactivity check). These receive a `room` and an optional `phase_index`.

### 4.1 Step-by-step: Adding a Post Rule

The following example adds a rule that nudges a user if their message contains no punctuation, suggesting it may lack structure.

**Step 1 — Define any constants at the top of `agents.py`**

```python
UNPUNCTUATED_MIN_LENGTH = 30
UNPUNCTUATED_COOLDOWN = timedelta(minutes=5)
```

**Step 2 — Write the rule function**

Add the function anywhere in `agents.py` before the `check_post_rules` dispatcher:

```python
def check_unpunctuated_message_rule(room, post) -> bool:
    agent = _agent("Facilitator Agent", "Encourages quieter members to participate.")
    rule_name = f"unpunctuated_message:user={post.author.id}"
    cooldown_since = timezone.now() - UNPUNCTUATED_COOLDOWN

    if _recent(room, agent, rule_name, cooldown_since, post.phase_index, recipient=post.author):
        return False

    content = (post.content or "").strip()
    if len(content) < UNPUNCTUATED_MIN_LENGTH:
        return False
    if any(c in content for c in [".", "?", "!", ","]):
        return False

    explanation = "Message lacks punctuation, which may indicate incomplete reasoning."
    message = "Try adding punctuation to structure your thoughts more clearly!"

    _create(room, agent, rule_name, message, explanation, post.phase_index, recipient=post.author)
    return True
```

**Step 3 — Register the rule in `check_post_rules`**

At the bottom of `agents.py`, find the `check_post_rules` function and add your rule:

```python
def check_post_rules(room, post):
    triggered = []
    # ... existing rules ...
    if check_unpunctuated_message_rule(room, post):
        triggered.append("unpunctuated_message")
    return triggered
```

> **Note:** The string passed to `triggered.append` is the rule's display name used in logs and analytics. Keep it short and snake_case.

### 4.2 Step-by-step: Adding a Room/Phase Rule

Room/phase rules follow the same pattern but receive `room` and `phase_index` instead of a post. Register them in `check_room_state_rules` instead of `check_post_rules`.

Example — a rule that fires if a phase has been running for more than 10 minutes with fewer than 3 messages:

```python
LOW_ENGAGEMENT_COOLDOWN = timedelta(minutes=5)
LOW_ENGAGEMENT_MIN_POSTS = 3
LOW_ENGAGEMENT_WINDOW = timedelta(minutes=10)

def check_low_engagement_rule(room, phase_index=None) -> bool:
    agent = _agent("Facilitator Agent", "Encourages quieter members to participate.")
    rule_name = "low_engagement"
    cooldown_since = timezone.now() - LOW_ENGAGEMENT_COOLDOWN

    if _recent(room, agent, rule_name, cooldown_since, phase_index):
        return False

    window_start = timezone.now() - LOW_ENGAGEMENT_WINDOW
    count = phase_posts(room, phase_index=phase_index).filter(created_at__gte=window_start).count()

    if count >= LOW_ENGAGEMENT_MIN_POSTS:
        return False

    explanation = f"Only {count} messages in the last 10 minutes."
    message = "Things seem quiet — does anyone have a thought or question to get things going?"

    _create(room, agent, rule_name, message, explanation, phase_index)
    return True
```

Then register it in `check_room_state_rules`:

```python
if check_low_engagement_rule(room, phase_index=phase_index):
    triggered.append("low_engagement")
```

### 4.3 Key Helper Functions Reference

| Function | Purpose |
|----------|---------|
| `_agent(name, description)` | Gets or creates an Agent record in the database. Use one of the existing agent names: `"Facilitator Agent"`, `"Equity Agent"`, `"Socratic Agent"`, or `"Evidence Agent"`. |
| `_recent(room, agent, rule_name, since, phase_index, recipient=None)` | Returns `True` if this rule has already fired recently for this room/user. Always call this at the top of a rule to respect cooldowns. |
| `_create(room, agent, rule_name, message, explanation, phase_index, recipient=None)` | Saves an intervention to the database. `message` is shown to users; `explanation` is the human-readable reason shown in the "Why am I seeing this?" panel. |
| `phase_posts(room, phase_index)` | Returns a queryset of posts for the current activity run and phase. Always use this rather than `Post.objects.filter()` directly. |
| `get_agent_config(room, key)` | Returns the merged agent settings for a given key (e.g. `"inactivity"`, `"equity"`, `"evidence"`), respecting any per-activity overrides. |

### 4.4 Adjusting Thresholds

Thresholds and cooldowns are defined as constants at the top of `agents.py`. For example:

```python
RAPID_FIRE_THRESHOLD = 10           # number of messages
RAPID_FIRE_WINDOW = timedelta(seconds=60)
RAPID_FIRE_COOLDOWN = timedelta(minutes=3)
```

To change a threshold, edit the relevant constant. No database changes are required, changes take effect immediately on the next rule check.

Some thresholds can also be overridden per-activity via the `agent_settings` field on the Activity model. The `DEFAULT_AGENT_SETTINGS` dictionary at the top of `agents.py` defines the fallback values for configurable rules (`equity`, `inactivity`, `evidence`).

---

## 5. Adding a New Activity

Activities can be added in two ways: via the facilitator UI, or by directly editing the fixture file.

### 5.1 Via the Facilitator UI (recommended for content)

Log in as a facilitator and use the activity authoring interface to create a new activity with phases, prompts, and agent threshold settings. This is the preferred method for adding content during normal use as it does not require editing code or reloading fixtures.

### 5.2 Via the Fixture File (for seeded/demo content)

The fixture file is located at:

```
backend/message_board/fixtures/activities.json
```

To add a new seeded activity, open the file and append a new entry following the existing structure. A minimal example:

```json
{
  "model": "message_board.activity",
  "pk": <next_available_integer>,
  "fields": {
    "name": "Your Activity Title",
    "description": "A short description of the activity.",
    "activity_type": "discussion",
    "agent_settings": {},
    "phases": [
      {
        "name": "Understand",
        "prompt": "Read the material and note your initial thoughts.",
        "time_limit_minutes": 5,
        "turn_limit": 10
      },
      {
        "name": "Propose",
        "prompt": "Share your proposed solution or position.",
        "time_limit_minutes": 10,
        "turn_limit": 20
      }
    ]
  }
}
```

Valid values for `activity_type` are: `problem-solving`, `discussion`, `design critique`.

After editing the file, reload the fixture into the database:

```bash
cd backend
python manage.py loaddata backend/message_board/fixtures/activities.json
```

> **Warning:** `loaddata` will attempt to insert or update records based on primary key. If you change the `pk` of an existing record it will create a duplicate. Always use the next available integer for new entries.

### 5.3 Per-Activity Agent Settings

The `agent_settings` field allows you to override the default agent thresholds for a specific activity. For example, to make the inactivity rule more lenient for a slow-paced reading activity:

```json
"agent_settings": {
  "inactivity": {
    "idle_seconds": 300,
    "cooldown_seconds": 300
  }
}
```

Any keys not specified in `agent_settings` will fall back to the `DEFAULT_AGENT_SETTINGS` values defined in `agents.py`. Set to an empty object `{}` to use all defaults.

---

## 6. Running Tests

The test suite uses pytest. All tests are located in the `backend/` directory.

### 6.1 Install Test Dependencies

Ensure your virtual environment is active (see section 3.2), then:

```bash
cd backend
pip install pytest pytest-django
```

### 6.2 Run the Full Test Suite

```bash
cd backend
pytest
```

### 6.3 Run a Specific Test File

```bash
pytest message_board/tests/test_agents.py
```

### 6.4 Run a Specific Test by Name

```bash
pytest -k test_equity_rule
```

### 6.5 Run with Verbose Output

```bash
pytest -v
```

> **Note:** Ensure your `.env` file is present and the database is running before executing tests. `pytest-django` will use the settings in `backend/mysite/settings.py` and create a temporary test database automatically.

---

## 7. Database Management

### 7.1 Applying Migrations

After any model changes, create and apply migrations:

```bash
python manage.py makemigrations
python manage.py migrate
```

### 7.2 Accessing the Django Admin

The Django admin interface provides direct access to all database records including rooms, users, activities, agents, and interventions.

Create a superuser if one does not already exist:

```bash
python manage.py createsuperuser
```

Then navigate to `/admin/` in the browser while the development server is running and log in with the superuser credentials.

> **Warning:** The Django admin interface exposes all user data and system records. Never share admin credentials or expose the `/admin/` endpoint in a public demo or forwarded Codespaces port.

### 7.3 Manual Room and Data Deletion

Rooms and their associated messages, interventions, and session summaries can be deleted via the Django admin interface. Navigate to the Room section, select the relevant room(s), and use the Delete action.

The system also has an automated retention policy that removes inactive rooms and their associated data after a defined inactivity period. This runs automatically and does not require manual intervention under normal operation.

### 7.4 Resetting the Database

To fully reset the database during development (e.g. after a Codespace rebuild):

```bash
python manage.py migrate
python manage.py loaddata backend/message_board/fixtures/activities.json
```

> **Note:** This will clear all rooms, messages, and users. Only seeded activities and agent records will remain after the fixture reload.

---

## 8. Deployment Notes

The system is currently deployed via GitHub Codespaces. The following practices must be followed:

- All secrets (database credentials, `SECRET_KEY`) must be set as environment variables and must not be committed to version control.
- When forwarding a Codespaces port for a demo, treat the URL as publicly accessible. Ensure authentication is required for all non-public endpoints.
- Set `DEBUG=False` in any environment where the forwarded URL is shared outside the team.
- The `SECRET_KEY` in `settings.py` has an insecure hardcoded fallback. Always set this via environment variable before any public-facing use.
- Database ports should not be forwarded publicly. Only the Django application port needs to be accessible.

If the system is migrated to an external host in future, additional steps will be required including configuring `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, and SSL settings — all of which are already partially configured in `settings.py`.

---

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| Migrations fail on startup | Ensure PostgreSQL is running and `DB_HOST`, `DB_USER`, `DB_PASSWORD` are set correctly in `.env` |
| Fixtures fail to load | Check that `pk` values in `activities.json` are unique and do not conflict with existing records. Delete conflicting records via Django admin first if needed. |
| Agent rules not triggering | Check that the agent is marked `is_active=True` in the database (Django admin > Agents). Also verify the rule is registered in `check_post_rules` or `check_room_state_rules`. |
| CORS errors in the browser | Ensure the frontend URL is listed in `CORS_ALLOWED_ORIGINS` in `settings.py` or matches the `CORS_ALLOWED_ORIGIN_REGEXES` pattern for dev tunnels. |
| CSRF token errors | Ensure the frontend origin is in `CSRF_TRUSTED_ORIGINS`. For Codespaces dev tunnels, the wildcard `https://*.devtunnels.ms` should cover most cases. |
| Tests fail with database errors | Ensure `pytest-django` is installed and the database is accessible. Check that `conftest.py` or `pytest.ini` references the correct Django settings module. |
| `SECRET_KEY` warning in logs | Set the `SECRET_KEY` environment variable in `.env`. The hardcoded fallback triggers Django's security warning and must not be used in production. |