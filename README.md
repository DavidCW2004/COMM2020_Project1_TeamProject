# Social Study Teammates

Learning platform that facilitates fair collaboration in given tasks

--- 

## Links
- Repository : https://github.com/DavidCW2004/COMM2020_Project1_TeamProject

---

## Tech Stack 
**Frontend**
- Vite + React + TypeScript

**Backend**
- Djano + Django REST Framework

---

## Repository Structure
- `frontend/` — Vite + React + TypeScript client
- `backend/` — Django + DRF API (rooms, activities, agents, summaries)
- `setup_env.sh` — Codespaces environment setup script
- `SOFTWARE_INVENTORY.md` — software inventory (runtime + dependencies)
- `README.md`

--- 

## Quickstart (Preferred) : Github Codespaces

### 1. Run environment setp (Codespaces)

```bash 
chmod +x setup_env.sh
source ./setup_env.sh
```

### 2. Start backend and frontend

Follow instructions provided in terminal to start the frontend and backend

### 3. Set ports to public

Enter ports tab and set port visibility to public for both backend and frontend

### 4. Open the app 
Use the Codespaces forwarded port link for the frontend

## Environment Variables

### Backend : (example)

```bash 
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_NAME=postgres
DB_PASSWORD=12345
```

### Frontend : (example)

VITE_API_BASE_URL=/

## Run Locally

### Prerequisites
- Node.js + npm (see `SOFTWARE_INVENTORY.md`)
- Python 3.11 + 

### Backend (Local)

1. Create and activate a virtual environment

```bash
cd backend
python -m venv .venv
```
`.\.venv\Scripts\Activate.ps1 `
2. Install dependencies 

`pip install -r requirements.txt`

3. Start the backend server

`python manage.py runsever`

### Frontend (Local)

1. Install dependencies 

```bash
cd frontend
npm install
```

2. Start the dev server

`npm run dev`


## Automated Tests

This repo includes autoamted tests

### Run backend tests 

1. Activate your backend virtual envronment (see Backend setup above), then : 

```bash
cd backend
pytest
```

If pytest is not installed in your enviornment:

```bash
pip install pytest pytest-django
pytest
```

## Software Inventory

See : `SOFTWARE_INVENTORY.md`

## Team Workflow

- Use branches and open push requests into `main`
- Pull latest `main` before starting new work to avoid merge conflicts
- Keep commits small and descriptive

## License

This project is licensed under the MIT License 