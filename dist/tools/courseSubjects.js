"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryCourseSubjects = void 0;
const database_1 = __importDefault(require("../database"));
exports.queryCourseSubjects = {
    name: "query_course_subjects",
    description: "Fetch mapping between courses and subjects",
    schema: {
        table: "courses_coursesubjects",
        allowedOps: ["SELECT"],
        allowedColumns: [
            "id", "course_id", "subject_id", "order", "created_at"
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
            console.error("❌ query_course_subjects error:", err);
            return { error: "Unexpected database error." };
        }
    }
};
//# sourceMappingURL=courseSubjects.js.map