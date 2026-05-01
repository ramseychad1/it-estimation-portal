package com.acme.estimator.users;

import com.acme.estimator.auth.User;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Same UTF-8-with-BOM, RFC 4180 quoting pattern as TeamCsvWriter.
 * Columns: id, email, first_name, last_name, status, roles, last_active_at, created_at.
 * Roles are joined with "; " inside the quoted cell so a comma in a role
 * name (unlikely but possible) doesn't break the column count.
 */
public final class UserCsvWriter {

    private static final byte[] UTF8_BOM = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private UserCsvWriter() {}

    public static void write(OutputStream out, List<User> users) throws IOException {
        out.write(UTF8_BOM);
        try (Writer w = new OutputStreamWriter(out, StandardCharsets.UTF_8)) {
            w.write("id,email,first_name,last_name,status,roles,last_active_at,created_at\n");
            for (User u : users) {
                w.write(String.valueOf(u.getId()));
                w.write(',');
                w.write(quote(u.getEmail()));
                w.write(',');
                w.write(quote(u.getFirstName()));
                w.write(',');
                w.write(quote(u.getLastName()));
                w.write(',');
                w.write(quote(u.getInvitationStatus().name()));
                w.write(',');
                w.write(quote(u.getRoles().stream()
                    .map(r -> r.getName())
                    .sorted()
                    .collect(Collectors.joining("; "))));
                w.write(',');
                w.write(quote(u.getLastActiveAt() == null ? "" : ISO.format(u.getLastActiveAt())));
                w.write(',');
                w.write(quote(u.getCreatedAt() == null ? "" : ISO.format(u.getCreatedAt())));
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
