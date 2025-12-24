import pool from "../database";

export const insertQuestionToDB = async (data: any, row: any) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const tqRes = await client.query(
            `
      INSERT INTO questions_testquestions
        (id_number, topic_id, question_type, level, pass_percentage, status,simulation_type,created_at,updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6,$7,$8,$9)
      RETURNING id
      `,
            [
                row["Question Number"],
                row["Topic Id"],
                1,
                row["level"],
                row["passpercentage"],
                false,
                1,
                new Date(),
                new Date()
            ]
        );

        const testQuestionId = tqRes.rows[0].id;
        console.log(testQuestionId, '----- quesiotn id----------');
        console.log(data, '----------data----------')
        await client.query(
            `
      INSERT INTO questions_questioncontents
        (test_question_id, question, solution_description,created_at,updated_at)
      VALUES
        ($1, $2, $3,$4,$5)
      `,
            [
                testQuestionId,
                data.redrafted_question_html,
                data.redrafted_solution_html,
                new Date(),
                new Date()
            ]
        );

        const optionIds: number[] = [];

        for (const opt of data.redrafted_options) {
            const optRes = await client.query(
                `
        INSERT INTO questions_questionoptions
          (test_question_id, option,created_at,updated_at)
        VALUES
          ($1, $2,$3,$4)
        RETURNING id
        `,
                [testQuestionId, opt, new Date(), new Date()]
            );

            optionIds.push(optRes.rows[0].id);
        }

        const correctIndex = data.correct_option - 1;
        const correctOptionId = optionIds[correctIndex];

        await client.query(
            `
      UPDATE questions_testquestions
      SET right_option_id = $1
      WHERE id = $2
      `,
            [correctOptionId, testQuestionId]
        );

        await client.query("COMMIT");

        return { testQuestionId, correctOptionId };
    } catch (err) {
        await client.query("ROLLBACK");
        console.log(err, '----------error----------')
        throw err;
    } finally {
        client.release();
    }
};
