import pool from "../database";
import { Tool } from "../utils";

export const queryCourses: Tool = {
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
            console.error("❌ query_courses error:", err);
            return { error: "Unexpected database error." };
        }
    }
};
