package com.acme.estimator.auth;

import java.util.Collection;
import java.util.List;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

@RequiredArgsConstructor
@Getter
public class AppUserDetails implements UserDetails {

    private final User user;

    public Long getUserId() {
        return user.getId();
    }

    public String getFirstName() {
        return user.getFirstName();
    }

    public String getLastName() {
        return user.getLastName();
    }

    public List<String> getRoleNames() {
        return user.getRoles().stream().map(Role::getName).sorted().toList();
    }

    /**
     * Spring Security's {@code hasRole('X')} matches authority {@code ROLE_X}
     * case-sensitively, so we uppercase the role name (and replace spaces
     * with underscores) when building the authority. The display name on
     * {@link Role#getName()} stays in title case for UI rendering.
     *   "Admin"           → "ROLE_ADMIN"
     *   "Solution Owner"  → "ROLE_SOLUTION_OWNER"
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return user.getRoles().stream()
                .map(r -> new SimpleGrantedAuthority(
                    "ROLE_" + r.getName().toUpperCase().replace(' ', '_')
                ))
                .toList();
    }

    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.isActive();
    }
}
