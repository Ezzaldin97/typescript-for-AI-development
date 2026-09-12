import { connect } from '@tursodatabase/serverless';
import type { Connection } from '@tursodatabase/serverless';
import { UIMessage } from 'ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

let conn: Connection | undefined;

const getConn = (): Connection => {
    if (!conn) {
        conn = connect({
            url: process.env.TURSO_DATABASE_URL || '',
            authToken: process.env.TURSO_AUTH_TOKEN || '',
        });
    }
    return conn;
};

// Schema init runs once per process, before the first query.
let ready: Promise<unknown> | undefined;

const getReady = (): Promise<unknown> => {
    if (!ready) {
        ready = getConn().batch([
            `CREATE TABLE IF NOT EXISTS chats(
                id TEXT PRIMARY KEY,
                messages TEXT NOT NULL DEFAULT '[]',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );`,
        ]);
    }
    return ready;
};

export const createChat = async (id: string): Promise<void> => {
    await getReady();
    await getConn().run(
        'INSERT OR IGNORE INTO chats VALUES(?, ?, ?, ?)',
        [id, '[]', Date.now(), Date.now()]
    );
};

export const ensureChat = async (id: string): Promise<void> => {
    await createChat(id);
};

export const loadChat = async (id: string): Promise<UIMessage[]> => {
    await getReady();
    const row = (await getConn().get('SELECT messages FROM chats WHERE id = ?', [id])) as
        | { messages: string }
        | undefined;
    return row ? JSON.parse(row.messages) : [];
};

export const saveChat = async (id: string, messages: UIMessage[]): Promise<void> => {
    await getReady();
    await getConn().run(
        `INSERT INTO chats(id, messages, created_at, updated_at)
         VALUES(?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
             messages = excluded.messages,
             updated_at = excluded.updated_at`,
        [id, JSON.stringify(messages), Date.now(), Date.now()]
    );
};

export const listChats = async (): Promise<{ id: string; updated_at: number }[]> => {
    await getReady();
    return (await getConn().all(
        'SELECT id, updated_at FROM chats ORDER BY updated_at DESC'
    )) as { id: string; updated_at: number }[];
};

export const deleteChat = async (id: string): Promise<void> => {
    await getReady();
    await getConn().run('DELETE FROM chats WHERE id = ?', [id]);
};
