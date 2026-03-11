# Data Management

Date: 2026-03-11

## Overview

The application stores most data in the Django database. Depending on configuration, the database can either be:

- PostgreSQL when `DB_HOST` is configured
- SQLite when `DB_HOST` is not configured

## Main Stored Entities

The core data model currently includes:

- `User` and `UserProfile`: authentication and application role
- `Room`: collaborative room space
- `RoomMember`: learner membership in a room
- `Post`: messages in the discussion
- `Activity`: structured tasks and their definitions, phases, and agent settings
- `Agent`: automated intervention agent definitions
- `Intervention`: messages generated when agent rules are activated
- `EvidenceNudgeState`: state used for evidence-related nudges
- `SessionSummary`: summary output stored as JSON
- `FinalAnswerSelection` and `FinalAnswerVote`: final answer workflow data

## Data Relationships

High-level relationships:

- a user has one profile with a role
- a room can have many members and many posts
- a room has one selected activity
- using JSON, an activity can define multiple phases
- interventions are linked to both a room and an agent
- summaries are linked to a room and an activity run

## Summary Data Storage

Session summaries are stored in `SessionSummary` and include four sections:

- `participation_data`
- `process_data`
- `quality_data`
- `extracted_content`

These fields store data created using chat data, and dont store the raw chat data.

The project software inventory is stored separately in `SOFTWARE_INVENTORY.md`.

Current summary generation includes:

- ammount of participation per member
- phase-level activity statistics
- intervention counts per rule
- quality flags like lack of evidence or unbalanced participation
- extracted decisions, action items, unanswered questions, and final outcomes

## PDF Output

Summary data can be turned into a PDF using ReportLab. The PDF includes:

- room and activity details
- key decisions
- action items
- unanswered questions
- group outcome
- participation statistics
- process analytics
- quality assessment

The PDF is just for exporting data. The summary record that this is used to create the pdf remains in the database.

## Authentication And Role Data

Role handling is stored in `UserProfile.role` with the following roles:

- `learner`
- `facilitator`
- `maintainer`

Profile records are created automatically when a Django user is created.

## Seed And Fixture Data

Activities are stored in:

- `backend/message_board/fixtures/activities.json`

This can be loaded with:

```powershell
cd backend
python manage.py loaddata message_board/fixtures/activities.json
```

## Retention And Backup Considerations

No automated backup or retention was created for this project.

When used by clients, the following needs to be considered outside the current project scope:

- how long room and summary data should be retained
- whether old learner accounts should be periodically removed
- how PostgreSQL backups will be taken and restored

## Data Management Limitations

- no formal retention policy was created
- no export abilities beyond PDF summaries were created
- no database backup scripts are included
- no audit log to capture admin actions