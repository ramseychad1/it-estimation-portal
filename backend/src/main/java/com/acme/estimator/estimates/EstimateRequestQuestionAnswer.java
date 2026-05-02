package com.acme.estimator.estimates;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One question/answer pair on an estimate request.
 *
 * <p>While the request is in {@code DRAFT} the answer rows are mutable
 * (the requester may rewrite their answer multiple times before submitting);
 * {@link #questionTextSnapshot} stays in sync with the question's current
 * text. On submission both the answer text and the question text are
 * frozen — future edits to the original {@code CriticalQuestion} don't
 * rewrite the snapshot.
 */
@Entity
@Table(name = "estimate_request_question_answers")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class EstimateRequestQuestionAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "estimate_request_id", nullable = false, updatable = false)
    private Long estimateRequestId;

    @Column(name = "critical_question_id", nullable = false, updatable = false)
    private Long criticalQuestionId;

    @Column(name = "question_text_snapshot", nullable = false)
    private String questionTextSnapshot;

    @Column(name = "answer_text", nullable = false)
    private String answerText;
}
