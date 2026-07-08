-- UX-2: typed question inputs.
-- Every existing question becomes LONG_TEXT (the pre-UX-2 behavior: a
-- free-text textarea), so this migration changes nothing until an admin
-- retypes a question in the catalog.
--
-- options_json holds a JSON array of option strings and is only populated
-- when question_type = 'SINGLE_SELECT'. Answers stay TEXT in
-- estimate_request_question_answers ("Yes"/"No", the chosen option text,
-- or a decimal string) so snapshot semantics are untouched.
ALTER TABLE critical_questions
    ADD COLUMN question_type VARCHAR(20) NOT NULL DEFAULT 'LONG_TEXT'
        CHECK (question_type IN ('LONG_TEXT', 'SHORT_TEXT', 'YES_NO', 'SINGLE_SELECT', 'NUMBER')),
    ADD COLUMN options_json TEXT;
