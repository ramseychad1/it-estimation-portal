package com.acme.estimator.settings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "app_settings")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class AppSetting {

    @Id
    @Column(name = "key", nullable = false, updatable = false, length = 100)
    private String key;

    @Column(name = "value", nullable = false, length = 500)
    private String value;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;
}
