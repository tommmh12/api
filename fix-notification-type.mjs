import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'nexus_db'
});

const sql = `ALTER TABLE notifications MODIFY COLUMN type ENUM('like','comment','upvote','mention','system','task_assigned','task_updated') NOT NULL`;

await conn.execute(sql);

console.log('✅ Updated notification type ENUM to include task_assigned and task_updated');
await conn.end();
