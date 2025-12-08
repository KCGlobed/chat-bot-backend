"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryQuestions = void 0;
// tools/queryQuestions.ts
const database_1 = __importDefault(require("../database"));
exports.queryQuestions = {
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
    async execute(input) {
        try {
            if (!input?.sql)
                return { error: "Missing SQL" };
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
            const result = await database_1.default.query(query);
            return { rows: result.rows };
        }
        catch (err) {
            console.error("❌ query_questions error:", err);
            return { error: "Unexpected database error." };
        }
    }
};
//# sourceMappingURL=queryQuestion.js.map