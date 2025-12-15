# Nexus Database Setup

## Prerequisites

- MySQL 8.0+ installed
- MySQL Server running

## Quick Start

### Option 1: Run Setup Script (Recommended)

```powershell
# Navigate to the database folder
cd backend\src\infrastructure\database

# Run the setup script
.\setup-database.ps1
```

The script will:

1. Ask for MySQL credentials
2. Test connection
3. Show all migration files to be executed
4. Ask for confirmation
5. Execute all migrations in order
6. Display summary and list all created tables

### Option 2: Manual Execution

Run each migration file in order:

```powershell
$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

# 1. Create database
& $mysqlPath -u root -p < migrations\001_create_database.sql

# 2. Create users and departments
& $mysqlPath -u root -p < migrations\002_create_users_and_departments.sql

# 3. Create projects and tasks
& $mysqlPath -u root -p < migrations\003_create_projects_and_tasks.sql

# 4. Create forum tables
& $mysqlPath -u root -p < migrations\004_create_forum_tables.sql

# 5. Create news tables
& $mysqlPath -u root -p < migrations\005_create_news_tables.sql

# 6. Create workspace and events
& $mysqlPath -u root -p < migrations\006_create_workspace_and_events.sql

# 7. Create system tables
& $mysqlPath -u root -p < migrations\007_create_system_tables.sql
```

## Database Information

- **Database Name**: `nexus_db`
- **Character Set**: `utf8mb4`
- **Collation**: `utf8mb4_unicode_ci`
- **Engine**: InnoDB

## Tables Created

### User & Organization (7 tables)

- departments
- users
- user_linked_accounts
- user_sessions

### Projects & Tasks (11 tables)

- workflows
- workflow_statuses
- projects
- project_departments
- tasks
- task_tags
- task_checklist_items
- task_comments
- task_attachments
- project_documents
- project_reports

### Forum & Communication (10 tables)

- forum_categories
- forum_posts
- forum_post_tags
- forum_comments
- forum_votes
- forum_polls
- forum_poll_options
- forum_poll_votes
- forum_saved_posts
- forum_subscriptions

### News & Content (2 tables)

- news_articles
- news_article_tags

### Workspace & Events (5 tables)

- events
- event_departments
- event_attendees
- meeting_rooms
- meeting_bookings

### System & Settings (5 tables)

- notifications
- activity_logs
- alert_rules
- backup_files
- system_settings

**Total: 37 tables**

## Verify Installation

```powershell
# Connect to MySQL
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p

# Inside MySQL shell
USE nexus_db;
SHOW TABLES;
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'nexus_db';
```

You should see 37 tables.

## Connection String Examples

### Node.js (mysql2)

```javascript
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "your_password",
  database: "nexus_db",
  charset: "utf8mb4",
});
```

### Prisma

```prisma
datasource db {
  provider = "mysql"
  url      = "mysql://root:password@localhost:3306/nexus_db"
}
```

### TypeORM

```typescript
{
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'your_password',
  database: 'nexus_db',
  charset: 'utf8mb4',
  entities: ['src/domain/entities/*.ts'],
  synchronize: false
}
```

## Troubleshooting

### Error: Access denied for user

- Check your MySQL username and password
- Make sure MySQL server is running

### Error: Unknown database

- Run migration 001_create_database.sql first

### Error: Table already exists

- Drop the database and start over:
  ```sql
  DROP DATABASE IF EXISTS nexus_db;
  ```

## Next Steps

1. Run seed data (if available)
2. Configure your backend application
3. Test database connections
4. Set up database backups

## Security Notes

⚠️ **Important**:

- Change default passwords in production
- Use environment variables for credentials
- Set up proper user permissions
- Enable SSL connections for production
- Regular backups recommended
