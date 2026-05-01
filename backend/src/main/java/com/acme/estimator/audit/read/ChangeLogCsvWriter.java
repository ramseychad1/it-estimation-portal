package com.acme.estimator.audit.read;

import com.acme.estimator.audit.ChangeLogEntry;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Same UTF-8-with-BOM, RFC 4180 quoting pattern as the Team / User
 * exporters. Exports raw {@code change_log} rows (un-grouped) — matches
 * the prompt's column list:
 *   timestamp, actor_id, actor_name, action, entity_type, entity_id,
 *   entity_name, field, old_value, new_value, source.
 */
public final class ChangeLogCsvWriter {

    private static final byte[] UTF8_BOM = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private ChangeLogCsvWriter() {}

    public static void write(
        OutputStream out,
        List<ChangeLogEntry> rows,
        Map<Long, String> actorNames,
        Map<String, Map<Long, String>> entityNamesByType
    ) throws IOException {
        out.write(UTF8_BOM);
        try (Writer w = new OutputStreamWriter(out, StandardCharsets.UTF_8)) {
            w.write("timestamp,actor_id,actor_name,action,entity_type,entity_id,entity_name,field,old_value,new_value,source\n");
            Set<String> seenTypes = new HashSet<>();
            for (ChangeLogEntry r : rows) {
                seenTypes.add(r.getEntityType());

                w.write(quote(r.getChangedAt() == null ? "" : ISO.format(r.getChangedAt())));
                w.write(',');
                w.write(String.valueOf(r.getChangedBy()));
                w.write(',');
                w.write(quote(actorNames.getOrDefault(r.getChangedBy(), UserNameResolver.DELETED)));
                w.write(',');
                w.write(quote(r.getAction().name()));
                w.write(',');
                w.write(quote(r.getEntityType()));
                w.write(',');
                w.write(String.valueOf(r.getEntityId()));
                w.write(',');
                w.write(quote(entityNamesByType
                    .getOrDefault(r.getEntityType(), Map.of())
                    .getOrDefault(r.getEntityId(), "")));
                w.write(',');
                w.write(quote(nullToEmpty(r.getFieldName())));
                w.write(',');
                w.write(quote(nullToEmpty(r.getOldValue())));
                w.write(',');
                w.write(quote(nullToEmpty(r.getNewValue())));
                w.write(',');
                w.write(quote(r.getSource() == null ? "WEB" : r.getSource().name()));
                w.write('\n');
            }
            w.flush();
        }
    }

    private static String quote(String value) {
        if (value == null) return "\"\"";
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
