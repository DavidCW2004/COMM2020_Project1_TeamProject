#!/bin/bash
# 0.Set up in reqiurement.txt
pip install -r backend/requirements.txt

# 1.Permission Hack for Codespaces
echo "Configuring passwordless sudo..."
echo "codespace ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/90-codespace
sudo rm -f /etc/apt/sources.list.d/yarn.list

# 2.Database Installation & Start
echo "Updating and installing PostgreSQL..."
sudo apt-get update --fix-missing || true 
sudo apt-get install -y postgresql postgresql-contrib


echo "Starting PostgreSQL service..."
sudo service postgresql start
sleep 2

# 3.Database Configuration
echo "Configuring user 'postgres' with password '12345'..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '12345';"

# 4.Set Environment Variables for this session
export DB_HOST=127.0.0.1
export DB_PORT=5432
export DB_USER=postgres
export DB_NAME=postgres
export DB_PASSWORD=12345

# 5.Backend Migration & Data Load
echo "Initializing Django Database..."
cd backend
python manage.py migrate
python manage.py loaddata message_board/fixtures/activities.json

# 6.Frontend Env Setup
echo "Creating Frontend .env file..."
cd ../frontend
echo "VITE_API_BASE_URL=/" > .env
cd ../

echo "------------------------------------------------"
echo "✅ SETUP COMPLETE!"
echo "1. Run 'cd backend && python manage.py runserver' in this terminal."
echo "2. Open a NEW terminal and run 'cd frontend && npm install && npm run dev'."
echo "3. Remember to set both ports to PUBLIC!"
echo "------------------------------------------------"
