package com.acme.estimator.audit.read;

import com.acme.estimator.catalog.questions.CriticalQuestion;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Question "names" are derived from the question text (truncated). The
 * underlying field is large, so the displayed name in the change log is
 * a short label that reads cleanly inside a sentence —
 * "...updated CriticalQuestion 'How many users will use this?'".
 */
@Component
@RequiredArgsConstructor
class CriticalQuestionNameResolver implements EntityNameResolver {

    static final String DELETED = "Deleted question";
    private static final int MAX_LABEL_CHARS = 80;

    private final CriticalQuestionRepository questionRepository;

    @Override
    public String entityType() {
        return CriticalQuestion.ENTITY_TYPE;
    }

    @Override
    public Map<Long, String> resolveNames(Set<Long> ids) {
        Map<Long, String> out = new HashMap<>(ids.size());
        for (Long id : ids) out.put(id, DELETED);
        questionRepository.findAllById(ids).forEach(q -> out.put(q.getId(), shorten(q.getQuestionText())));
        return out;
    }

    @Override
    public Set<Long> findIdsMatchingName(String search) {
        return new HashSet<>(questionRepository.findIdsByQuestionTextContainingIgnoreCase(search));
    }

    /**
     * Word-boundary-aware truncation: cut at the last whitespace before
     * the {@link #MAX_LABEL_CHARS} budget, so the feed reads
     * "How many users…" rather than "How many user…". Falls back to a
     * raw character cut only if there is no whitespace in the budget
     * (e.g. an extremely long single word).
     */
    static String shorten(String text) {
        if (text == null) return "(empty)";
        String trimmed = text.strip();
        if (trimmed.length() <= MAX_LABEL_CHARS) return trimmed;

        int budget = MAX_LABEL_CHARS - 1; // reserve a char for the ellipsis
        int lastSpace = trimmed.lastIndexOf(' ', budget);
        // Require the boundary to be reasonably close to the budget,
        // otherwise we'd produce uselessly short labels for streams of
        // small words followed by one long token.
        int cut = lastSpace > budget / 2 ? lastSpace : budget;
        return trimmed.substring(0, cut).stripTrailing() + "…";
    }
}
