// tools/queryQuestions.ts
import pool from "../database";
import { Tool } from "../utils";

export const queryQuestions: Tool = {
  name: "query_questions",
  description: "Fetch questions from the question bank (with options and solution)",
  schema: {
    table: "questions_testquestions",
    allowedOps: ["SELECT"],
    allowedColumns: [
      "id", "id_number", "question_type", "level", "simulation_type",
      "chapter_id", "topic_id", "status", "created_at"
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

      const query = `
        SELECT tq.id, tq.id_number, tq.question_type, tq.level, tq.simulation_type,
               qc.question, qc.solution_description,
               ARRAY(
                 SELECT option FROM questions_questionoptions qo WHERE qo.test_question_id = tq.id
               ) AS options
        FROM questions_testquestions tq
        JOIN questions_questioncontents qc ON qc.test_question_id = tq.id
        WHERE tq.status = true
        LIMIT 10;
      `;

      const result = await pool.query(query);
      return { rows: result.rows };

    } catch (err) {
      console.error("❌ query_questions error:", err);
      return { error: "Unexpected database error." };
    }
  }
};
