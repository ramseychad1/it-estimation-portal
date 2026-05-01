package com.acme.estimator.audit.read;

import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.users.UserService;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Doubles as the actor-name resolver for the Change Log feed: the actor of
 * any change_log row is a user id, and the entity_type=User rows
 * (invitation accepts, password resets, hard-deleted users) all need the
 * same lookup. Same {@link #displayName} helper produces a consistent
 * format across all uses.
 */
@Component
@RequiredArgsConstructor
public class UserNameResolver implements EntityNameResolver {

    public static final String DELETED = "Deleted user";
    public static final String SYSTEM = "System";

    private final UserRepository userRepository;

    @Override
    public String entityType() {
        return UserService.ENTITY_TYPE;
    }

    @Override
    public Map<Long, String> resolveNames(Set<Long> ids) {
        Map<Long, String> out = new HashMap<>(ids.size());
        for (Long id : ids) {
            // Phase 1 used 0L as a synthetic system actor in a couple of
            // backfill paths; treat it consistently so the feed reads sanely.
            out.put(id, id != null && id == 0L ? SYSTEM : DELETED);
        }
        userRepository.findAllById(ids).forEach(u -> out.put(u.getId(), displayName(u)));
        return out;
    }

    @Override
    public Set<Long> findIdsMatchingName(String search) {
        return new HashSet<>(userRepository.findIdsByDisplayNameContainingIgnoreCase(search));
    }

    /** Public so {@code ChangeLogReadService} can resolve actor names too. */
    public static String displayName(User user) {
        String first = user.getFirstName() == null ? "" : user.getFirstName();
        String last = user.getLastName() == null ? "" : user.getLastName();
        String composed = (first + " " + last).trim();
        return composed.isEmpty() ? user.getEmail() : composed;
    }
}
