"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryCourses = void 0;
const database_1 = __importDefault(require("../database"));
exports.queryCourses = {
    name: "query_courses",
    description: "Fetch course information",
    schema: {
        table: "courses_course",
        allowedOps: ["SELECT"],
        allowedColumns: [
            "id", "name", "short_description", "description", "requirements",
            "duration", "price", "discount", "total_reviews", "total_video_duration",
            "total_questions", "avg_rating", "objectives_summary", "features",
            "status", "image", "banner_image", "created_at", "updated_at",
            "assessment_test_testlet", "assessment_test_each", "mock_test_pattern"
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
            console.error("❌ query_courses error:", err);
            return { error: "Unexpected database error." };
        }
    }
};
//# sourceMappingURL=courses.js.map