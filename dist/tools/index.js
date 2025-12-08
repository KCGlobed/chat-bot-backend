"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOLS = void 0;
exports.buildToolContext = buildToolContext;
const database_1 = __importDefault(require("../database"));
exports.TOOLS = {
    query_courses: {
        execute: async ({ sql }) => {
            if (!sql.toLowerCase().includes("courses_course")) {
                return { rows: [], error: "Query must target courses_course." };
            }
            const result = await database_1.default.query(sql);
            return { rows: result.rows };
        },
    },
    query_subjects: {
        execute: async ({ sql }) => {
            if (!sql.toLowerCase().includes("courses_subjects")) {
                return { rows: [], error: "Query must target courses_subjects." };
            }
            const result = await database_1.default.query(sql);
            return { rows: result.rows };
        },
    },
    query_course_subjects: {
        execute: async ({ sql }) => {
            // Ensure subject names are included
            let finalSql = sql;
            if (!sql.toLowerCase().includes("join")) {
                // Inject JOIN if missing
                finalSql = `
          SELECT cs.id, cs.name, cs.description
          FROM courses_coursesubjects ccs
          JOIN courses_subjects cs ON cs.id = ccs.subject_id
          WHERE ccs.course_id IN (
            SELECT id FROM courses_course WHERE ${sql.split("WHERE")[1] || "1=1"}
          )
        `;
            }
            const result = await database_1.default.query(finalSql);
            return { rows: result.rows };
        },
    },
    query_chapters: {
        execute: async ({ sql }) => {
            if (!sql.toLowerCase().includes("courses_chapters")) {
                return { rows: [], error: "Query must target courses_`chapters." };
            }
            const result = await database_1.default.query(sql);
            return { rows: result.rows };
        },
    },
    query_subject_chapters: {
        execute: async ({ sql }) => {
            let finalSql = sql;
            if (!sql.toLowerCase().includes("join")) {
                // Auto-join so we always get chapter names
                finalSql = `
              SELECT ch.id, ch.name, ch.description, ch.no_of_videos, ch.no_of_mcqs, ch.no_of_simulations
              FROM courses_subjectchapters csc
              JOIN courses_chapters ch ON ch.id = csc.chapter_id
              WHERE csc.subject_id IN (
                SELECT id FROM courses_subjects WHERE ${sql.split("WHERE")[1] || "1=1"}
              )
            `;
            }
            const result = await database_1.default.query(finalSql);
            return { rows: result.rows };
        },
    },
    query_questions: {
        execute: async ({ sql }) => {
            const lowerSql = sql.toLowerCase();
            // Allow these tables in query
            const allowedTables = [
                "questions_testquestions",
                "questions_questioncontents",
                "questions_questionoptions",
            ];
            const hasAllowedTable = allowedTables.some((tbl) => lowerSql.includes(tbl));
            if (!hasAllowedTable) {
                return {
                    rows: [],
                    error: "Query must target one of: questions_testquestions, questions_questioncontents, or questions_questionoptions.",
                };
            }
            // Always return rows from DB
            const result = await database_1.default.query(sql);
            return { rows: result.rows };
        },
    },
};
function buildToolContext() {
    return `
    - query_courses → SELECT from "courses_course"
      Allowed columns:
        id, name, short_description, description, requirements,
        duration, price, discount, total_reviews, total_video_duration,
        total_questions, avg_rating, objectives_summary, features,
        status, image, banner_image, created_at, updated_at,
        assessment_test_testlet, assessment_test_each, mock_test_pattern
  
    - query_subjects → SELECT from "courses_subjects"
      Allowed columns:
        id, name, description, status, created_at, updated_at,
        no_of_mcqs, no_of_simulations, no_of_videos, no_of_videos_duration, total_questions
  
    - query_course_subjects → SELECT course-subject mappings
      Must JOIN "courses_coursesubjects" with "courses_subjects"
      Always return subject names, not just IDs
      Allowed columns: course_id, subject_id, order, plus subject.name/description
  
    - query_chapters → SELECT from "courses_chapters"
      Allowed columns:
        id, name, description, no_of_videos, no_of_videos_dur,
        no_of_mcqs, no_of_simulations, total_questions, status, created_at, updated_at
  
    - query_subject_chapters → SELECT subject-chapter mappings
      Must JOIN "courses_subjectchapters" with "courses_chapters"
      Always return chapter names, not just IDs
      Allowed columns: subject_id, chapter_id, order, plus chapter.name/description
       - query_questions → SELECT from "questions_testquestions" + "questions_questioncontents"
      Must JOIN "questions_questioncontents" ON questions_testquestions.id = questions_testquestions.test_question_id
      Allowed columns:
        questions_testquestions.id_number, questions_testquestions.question_type, questions_testquestions.level, 
        questions_questioncontents.question, questions_questioncontents.solution_description, questions_questioncontents.sub_questions
- query_questions → SELECT from "questions_testquestions" + "questions_questioncontents"
    Must JOIN "questions_questioncontents"
    ON questions_testquestions.id = questions_questioncontents.test_question_id
    Allowed columns:
      questions_testquestions.id_number,
      questions_testquestions.question_type,
      questions_testquestions.level,
      questions_testquestions.right_option_id,
      questions_questioncontents.question,
      questions_questioncontents.solution_description,
      questions_questioncontents.sub_questions,
      questions_questionoptions.option

    🔹 If user input contains an id_number (like KCGFARFSRPM0002),
    always fetch the question + solution_description.

    🔹 If user asks "solution", "answer", "explain", return solution_description.  
    🔹 If user asks "give me the question", return the question text.  
    🔹 If both are asked, return both.  

    🔹 If user asks "options" for an id_number,
    fetch **id + option (text)** from "questions_questionoptions"
    where test_question_id matches questions_testquestions.id.

    🔹 If user asks "correct option" for an id_number,
    fetch option text from "questions_questionoptions"
    where id = questions_testquestions.right_option_id.

    ✅ Examples:
    - "Give me question KCGFARFSRPM0002" → return question text
    - "KCGFARFSRPM0002 ka solution" → return solution_description
    - "Explain KCGFARFSRPM0002" → return question + solution_description
    - "Give the options for KCGFARFSRPM0002" → return all option texts
    - "Give the correct option for KCGFARFSRPM0002" → return correct option text only`;
}
//# sourceMappingURL=index.js.map