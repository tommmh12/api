const mysql = require('mysql2/promise');

(async () => {
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '123456',
        database: 'nexus_db'
    });

    await conn.execute(
        "ALTER TABLE notifications MODIFY COLUMN type ENUM('like','comment','upvote','mention','system','task_assigned','task_updated') NOT NULL"
    );

    console.log('✅ Updated notification type ENUM to include task_assigned and task_updated');
    await conn.end();
})().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
