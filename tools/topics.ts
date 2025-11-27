import pool from "../database";
import { Tool } from "../utils";

export const queryTopics: Tool = {
    name: "query_topics",
    description: "Fetch topics mapped to chapters",
    schema: {
        table: "courses_topics",
        allowedOps: ["SELECT"],
        allowedColumns: ["id", "name", "description"]
    },
    async execute(input: { sql?: string }) {
        try {
            if (!input?.sql) return { error: "Missing SQL" };
            const sql = input.sql.trim();
            if (!sql.toLowerCase().startsWith("select")) {
                return { error: "Only SELECT queries are allowed." };
            }
            if (!sql.toLowerCase().includes(this.schema.table)) {
                return { error: `Query must use table ${this.schema.table}.` };
            }
            const result = await pool.query(sql);
            return { rows: result.rows };
        } catch (err) {
            console.error("❌ query_topics error:", err);
            return { error: "Unexpected database error." };
        }
    }
};