"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryTopics = void 0;
const database_1 = __importDefault(require("../database"));
exports.queryTopics = {
    name: "query_topics",
    description: "Fetch topics mapped to chapters",
    schema: {
        table: "courses_topics",
        allowedOps: ["SELECT"],
        allowedColumns: ["id", "name", "description"]
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
            console.error("❌ query_topics error:", err);
            return { error: "Unexpected database error." };
        }
    }
};
//# sourceMappingURL=topics.js.map