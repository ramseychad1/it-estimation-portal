package com.acme.estimator.teams;

import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * UTF-8-with-BOM CSV writer. Excel needs the BOM to render Unicode correctly;
 * other tools ignore it. All string fields are quoted unconditionally so a
 * later "someone added a comma to a description" doesn't silently corrupt
 * downstream imports. Embedded quotes are doubled per RFC 4180.
 *
 * The export carries the actor as two columns — updated_by_id (the FK value,
 * stable for re-import) and updated_by_name (the resolved display name at
 * export time, for human readability). The caller passes a name lookup map
 * that's been pre-fetched in a single batch query.
 */
public final class TeamCsvWriter {

    private static final byte[] UTF8_BOM = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private TeamCsvWriter() {}

    public static void write(
        OutputStream out,
        List<Team> teams,
        Map<Long, String> userIdToName
    ) throws IOException {
        out.write(UTF8_BOM);
        try (Writer w = new OutputStreamWriter(out, StandardCharsets.UTF_8)) {
            w.write("id,name,description,active,updated_at,updated_by_id,updated_by_name\n");
            for (Team team : teams) {
                w.write(String.valueOf(team.getId()));
                w.write(',');
                w.write(quote(team.getName()));
                w.write(',');
                w.write(quote(team.getDescription()));
                w.write(',');
                w.write(team.isActive() ? "true" : "false");
                w.write(',');
                w.write(quote(team.getUpdatedAt() == null ? "" : ISO.format(team.getUpdatedAt())));
                w.write(',');
                w.write(team.getUpdatedBy() == null ? "" : String.valueOf(team.getUpdatedBy()));
                w.write(',');
                w.write(quote(userIdToName.getOrDefault(team.getUpdatedBy(), "")));
                w.write('\n');
            }
            w.flush();
        }
    }

    private static String quote(String value) {
        if (value == null) return "\"\"";
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
