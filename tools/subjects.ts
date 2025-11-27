import pool from "../database";
import { Tool } from "../utils";

export const querySubjects: Tool = {
  name: "query_subjects",
  description: "Fetch subject information",
  schema: {
    table: "courses_subjects",
    allowedOps: ["SELECT"],
    allowedColumns: [
      "id", "name", "description", "status", "created_at", "updated_at",
      "no_of_mcqs", "no_of_simulations", "no_of_videos", "no_of_videos_duration",
      "total_questions"
    ]
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
      console.error("❌ query_subjects error:", err);
      return { error: "Unexpected database error." };
    }
  }
};
