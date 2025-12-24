import { Request, Response } from "express";
import * as XLSX from "xlsx";
import OpenRouterService, { OpenRouterMessage } from "../openrouter";
import { insertQuestionToDB } from "./insertInToDB";
const openRouterService = new OpenRouterService()

/* ---------------- SYSTEM PROMPT ---------------- */

const REDRAFT_SYSTEM_PROMPT = `
You are an exam content redrafting engine for professional qualification exams.

You will receive a question with four options, a correct option number,
and an original solution. Your task is to redraft the content so that it is:
- Clear
- Exam-ready
- Grammatically polished
- Structurally consistent
- Professionally explained

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRAINING EXAMPLES (STYLE REFERENCE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The examples below show EXACTLY how questions, options, and solutions
should be redrafted. These are NOT questions to answer.
They are STYLE AND FORMAT REFERENCES ONLY.

Study them carefully and replicate:
- The tone
- The wording style
- The level of explanation
- The HTML structure
- The option formatting

---------------- EXAMPLE 1 ----------------

ORIGINAL QUESTION:
Which TWO of the following are cultural types identified by Handy?
(i) Role
(ii) Person
(iii) Bureaucratic
(iv) Individual

ORIGINAL OPTIONS:
1. (ii) and (iii) only
2. (i) and (iii) only
3. (i), (ii) and (iii) only
4. (i) and (ii) only

CORRECT OPTION:
2

ORIGINAL SOLUTION:
The cultural types identified by Handy are role culture, person culture, task culture and power culture.

REDRAFTED OPTIONS:
1. Person and Bureaucratic only.
2. Role and Bureaucratic only.
3. Role, Person and Bureaucratic only.
4. Role and Person only.

REDRAFTED SOLUTION (HTML):
<body>
  <p>Charles Handy identified four types of organisational culture:</p>
  <ol style="list-style: lower-roman; margin-left: 2rem; margin-top: 1rem;">
    <li>Power Culture - centralised decision-making around one key individual or small group.</li>
    <li>Role Culture - where clearly defined roles, rules, and procedures dominate.</li>
    <li>Task Culture - teams are formed to solve particular problems.</li>
    <li>Person Culture - where the individual is the central focus.</li>
  </ol>
</body>

---------------- EXAMPLE 2 ----------------

ORIGINAL QUESTION:
Which of the following factors could influence the culture of an organisation?

ORIGINAL OPTIONS:
1. (i), (iii) and (iv)
2. (i), (ii), (iii) and (iv)
3. (ii), (iii) and (v)
4. (i), (ii), (iii), (iv) and (v)

CORRECT OPTION:
4

REDRAFTED OPTIONS:
1. 1, 3 and 4
2. 1, 2, 3 and 4
3. 2, 3 and 5
4. 1, 2, 3, 4 and 5

REDRAFTED SOLUTION (HTML):
<p>All of these factors have the potential to affect an organisational culture. Past experiences, leadership, founders, technology, and industry conditions all shape how an organisation operates.</p>

---------------- EXAMPLE 3 ----------------

ORIGINAL QUESTION:
Which of the following is one of the three levels of culture described by Schein?

ORIGINAL OPTIONS:
1. Things that are short term only
2. Things that are difficult to identify as they are unseen and often unconscious
3. Things that endure
4. Things that initially appear superficial

CORRECT OPTION:
2

REDRAFTED OPTIONS:
1. Things that are short term only, such as staffing levels.
2. Things that are difficult to identify as they are unseen and often unconscious.
3. Things that endure, such as organisational hierarchy.
4. Things that initially appear superficial, such as timekeeping rules.

REDRAFTED SOLUTION (HTML):
<p>According to Schein, these components of culture are known as basic assumptions and values. The other two levels are espoused values and artefacts.</p>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF TRAINING EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS FOR ALL NEW QUESTIONS:

1. Redraft the question so it is clear, professional, and exam-appropriate.
2. Redraft all four options while preserving their original meaning.
3. Redraft the solution with a concise but complete explanation.
4. Preserve all numeric values, technical terms, and factual correctness.
5. DO NOT change the correct option number.
6. Output the question and solution using VALID HTML ONLY.
7. Options must be plain text (no HTML).
8. Do NOT use markdown.
9. Do NOT include explanations outside the JSON.
10. Return ONLY valid JSON.

REQUIRED OUTPUT FORMAT:
{
  "redrafted_question_html": string,
  "redrafted_options": [string, string, string, string],
  "correct_option": number,
  "redrafted_solution_html": string
}
`;


/* ---------------- CONTROLLER ---------------- */

export const excelRedraft = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: "Excel file is required",
            });
        }

        /* ---------- READ EXCEL ---------- */
        const workbook = XLSX.read(req.file.buffer);
        const sheetName = "BT MCQ Sample";
        const sheet = workbook.Sheets[workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames[0]];
        const successResults: any[] = [];
        const failedResults: any[] = [];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        if (!rows.length) {
            return res.status(400).json({
                error: "Excel sheet is empty",
            });
        }

        const results: any[] = [];

        /* ---------- PROCESS EACH ROW ---------- */
        for (let i = 0; i < 5; i++) {
            const row = rows[i];
            console.log(row);
            try {
                const userPrompt = `
Original Question:
${row["Original Question"]}

Option 1:
${row["Option 1"]}

Option 2:
${row["Option 2"]}

Option 3:
${row["Option 3"]}

Option 4:
${row["Option 4"]}

Correct option:
${row["Correct option"]}

Original Solution:
${row["Original Solution"]}
`;

                const messages: OpenRouterMessage[] = [
                    { role: "system", content: REDRAFT_SYSTEM_PROMPT },
                    { role: "user", content: userPrompt },
                ];
                const raw = await openRouterService.verifyEssay(messages);
                let parsed;
                try {
                    parsed = JSON.parse(raw);
                } catch {
                    throw new Error("AI returned invalid JSON");
                }

                // ---------- 🔥 DB INSERT HAPPENS HERE ----------
                const dbResult = await insertQuestionToDB(parsed, row);

                // ---------- SUCCESS TRACK ----------
                successResults.push({
                    row: i + 1,
                    test_question_id: dbResult.testQuestionId,
                });

                results.push({
                    original_question: row["Original Question"],
                    redrafted_question_html: parsed.redrafted_question_html,
                    correct_option: parsed.correct_option,
                });

            } catch (err: any) {
                // ---------- FAIL → SKIP ----------
                console.error(`❌ Row ${i + 1} failed`, err.message);

                failedResults.push({
                    row: i + 1,
                    question: row["Original Question"],
                    error: err.message,
                });

                continue; // 🔥 NEXT QUESTION
            }
        }

    } catch (error: any) {
        console.error("❌ Excel redraft failed:", error);
        return res.status(500).json({
            error: "Excel redrafting failed",
            message: error.message || "Unknown error",
        });
    }
};