"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryChapterTopics = void 0;
const database_1 = __importDefault(require("../database"));
exports.queryChapterTopics = {
    name: "query_chapter_topics",
    description: "Fetch mapping between chapters and topics",
    schema: {
        table: "courses_chaptertopics",
        allowedOps: ["SELECT"],
        allowedColumns: [
            "id", "chapter_id", "topic_id", "order", "created_at"
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
            console.error("❌ query_chapter_topics error:", err);
            return { error: "Unexpected database error." };
        }
    }
};
//# sourceMappingURL=chapterTopics.js.map