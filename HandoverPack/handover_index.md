# Client Handover Pack

Date: 2026-03-11
Project: Social Study Teammates
Repository: `COMM2020_Project1_TeamProject`

## Purpose

This is the handover pack for the Social Study Teammates Project. It is used to help new clients or future maintainers understand what this project is and what is being delivered. It also covers how to run the project and how to maintain the project after submission.

## Delivered Items

The project handover includes:

- source code
- frontend `frontend/`
- backend `backend/`
- project `setup_env.sh`
- software inventory `SOFTWARE_INVENTORY.md`
- this handover pack `HandoverPack`

## System Overview

Social Study Teammates is a learning platform designed to promote more structured discussions, so that input is more equitable and discussions remain focused.

The platform provides:

- learner accounts for joining and participating in room activities
- facilitator access for creating new activities and watching over learner sessions
- maintainer access for admin application management
- room-based collaboration workflows with chat feature
- activity phases so that discussion remains structured
- automatic summaries and PDF export for session review

## User Roles

The system currently supports three roles:

- `learner`: joins rooms, participates in activities by chatting in the room
- `facilitator`: creates new activities, monitors sessions
- `maintainer`: signs in with username/password and manages the entire application

Role handling is implemented through `UserProfile.role` in the backend.

Important access detail:

- learners and facilitators are always created as temporary accounts
- maintainers must use a username and password

## Document Index

This pack is split into the following documents:

1. `handover_index.md`: overview of what has been delivered
2. `deployment_and_operations.md`: local setup, environment variables, startup, and operating notes
3. `maintenance_and_troubleshooting.md`: maintenance tasks, diagnostics, tests, and common problems
4. `data_management.md`: database, stored entities, summaries, and data handling considerations

## Repository Structure

- `frontend/`: React + TypeScript + Vite client
- `backend/`: Django application
- `backend/core/`: authentication and shared views
- `backend/message_board/`: rooms, messages, activities, summaries, PDF generation, tests
- `backend/facilitator_page/`: facilitator and maintainer APIs
- `SOFTWARE_INVENTORY.md`: runtime and dependency inventory
- `README.md`: project overview and quickstart

## Important Notes for Handover

- The current setup instructions are aimed at local development and Codespaces-style environments.
- The project can use PostgreSQL when database environment variables are provided.
- If it's not configured, it will fall back to SQLite.
- Session summaries are stored in the database and there is a feature to export to PDF.