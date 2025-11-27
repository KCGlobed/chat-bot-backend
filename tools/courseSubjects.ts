import pool from "../database";
import { Tool } from "../utils";

export const queryCourseSubjects: Tool = {
  name: "query_course_subjects",
  description: "Fetch mapping between courses and subjects",
  schema: {
    table: "courses_coursesubjects",
    allowedOps: ["SELECT"],
    allowedColumns: [
      "id", "course_id", "subject_id", "order", "created_at"
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
      console.error("❌ query_course_subjects error:", err);
      return { error: "Unexpected database error." };
    }
  }
};
