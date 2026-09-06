import Database from 'better-sqlite3';
import { UIMessage } from 'ai';
import path from 'path';

const memDBPath = path.join(path.dirname(path.dirname(__dirname)));
const db = new Database(path.join(memDBPath, 'mem.db'));

db.exec(
    `CREATE TABLE IF NOT EXISTS chats(
        id TEXT PRIMARY KEY,
        messages TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );`
);

export const createChat = (id: string): void => {
    db.prepare('INSERT OR IGNORE INTO chats VALUES(?, ?, ?, ?)').run(id, '[]', Date.now(), Date.now());
};

export const ensureChat = (id: string): void => {
    createChat(id);
};

export const loadChat = (id: string): UIMessage[] => {
    const row = db.prepare('SELECT messages FROM chats WHERE id=?').get(id) as any;
    return row ? JSON.parse(row.messages) : [];
}

export const saveChat = (id: string, messages: UIMessage[]) => {
    const info = db
        .prepare('UPDATE chats SET messages = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(messages), Date.now(), id);
    // Upsert: first save for a chatId that was never created still persists.
    if (info.changes === 0) {
        db.prepare('INSERT OR IGNORE INTO chats VALUES(?, ?, ?, ?)').run(
            id,
            JSON.stringify(messages),
            Date.now(),
            Date.now()
        );
    }
};

export const listChats = (): { id: string; updated_at: number }[] => {
    return db.prepare('SELECT id, updated_at FROM chats ORDER BY updated_at DESC').all() as {
        id: string;
        updated_at: number;
    }[];
};

export const deleteChat = (id: string): void => {
    db.prepare('DELETE FROM chats WHERE id = ?').run(id);
};