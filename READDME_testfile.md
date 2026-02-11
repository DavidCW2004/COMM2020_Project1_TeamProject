---

# 📄 CODE NAME: PROJECT TEOI1

This is a setup on codespace, for the remote environment.

---

## 🚀 Codespace Setup Instructions

### 1. Initialize Environment

* Click on the **Code** button in GitHub and the **+** icon to open a new Codespace.
* Once the terminal is ready, install the Python dependencies:
```bash
pip install -r backend/requirements.txt

```



### 2. Database Setup (PostgreSQL)

Since the Codespace image is fresh, you must install and configure the database engine manually.

**Install PostgreSQL:**

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib -y

```

**Start and Configure Service:**

1. Fix permissions to prevent password prompts (Optional but recommended):
```bash
echo "codespace ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/90-codespace

```


2. Start the service:
```bash
sudo service postgresql start

```


3. Set the database password for Django (using `12345` as the example):
```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '12345';"

```



**Set Environment Variables:**
Overwrite the default variables to ensure the Django Backend connects to the Postgres Port (**5432**).

```bash
export DB_HOST=127.0.0.1
export DB_PORT=5432
export DB_USER=postgres
export DB_NAME=postgres
export DB_PASSWORD=12345

```

### 3. Initialize Backend

```bash
cd backend
python manage.py migrate
python manage.py loaddata message_board/fixtures/activities.json
python manage.py runserver

```

---

## 🔑 Admin Account & Access

To manage users and view live data, create a Superuser:

1. Terminate the server (`Ctrl + C`).
2. Run the creation command:
```bash
python manage.py createsuperuser

```


3. **Username:** `admin` | **Password:** `12345` (Press `y` to bypass the "too common" password warning).

NOTE: The password wont display when typed in the terminal. It is an unknown bug and are still investigating. Proceed with caution when typing.

**Accessing the Admin Panel:**
Go to your forwarded URL and append `/admin` (e.g., `https://...-8000.app.github.dev/admin`). Here you can monitor all Learner and Facilitator data.

---

## 💻 Frontend Setup

Open a **new terminal** and perform the following:

**1. Establish API Connection:**
Create a file named `.env` inside the `frontend` directory:

```bash
echo "VITE_API_BASE_URL=/" > frontend/.env

```

**2. Install and Launch:**

```bash
cd frontend
npm install
npm run dev

```

---

## ✅ Critical Launch Checklist

Before sharing the link with others, ensure the following:

1. **Port Visibility:** Go to the **Ports** tab in the bottom panel. Right-click ports **3000** and **8000** and set **Port Visibility** to **Public**.
2. **Database Status:** If the app shows a "Database Error," ensure you ran `sudo service postgresql start`.
3. **Environment File:** Ensure the `frontend/.env` file exists. Without it, the frontend won't know where to send requests.
4. **Load Activities:** If the "Activity Catalogue" is empty, remember to run:
```bash
python manage.py loaddata message_board/fixtures/activities.json

```



---

## 🛠 Local Machine Hosting (Non-Codespace) STILL WIP

If hosting on a local Windows/Mac machine:

* Install PostgreSQL locally from the official website.
* Ensure the `DB_PASSWORD` in your `.env` or environment variables matches your local Postgres setup.
* Use `python` instead of `python3` depending on your PATH settings.

---
