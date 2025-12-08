"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.querySubjects = void 0;
const database_1 = __importDefault(require("../database"));
exports.querySubjects = {
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
            const result = await database_1.default.query(sql);
            return { rows: result.rows };
        }
        catch (err) {
            console.error("❌ query_subjects error:", err);
            return { error: "Unexpected database error." };
        }
    }
};
//# sourceMappingURL=subjects.js.map