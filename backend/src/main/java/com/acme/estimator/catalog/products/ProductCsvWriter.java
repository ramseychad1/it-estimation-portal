package com.acme.estimator.catalog.products;

import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * UTF-8 + BOM, RFC 4180 quoting. Same pattern as TeamCsvWriter / UserCsvWriter.
 * Columns: id, name, description, mode, status, created_at, created_by,
 * updated_at, updated_by.
 */
public final class ProductCsvWriter {

    private static final byte[] UTF8_BOM = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private ProductCsvWriter() {}

    public static void write(
        OutputStream out,
        List<Product> products,
        Map<Long, String> userNames
    ) throws IOException {
        out.write(UTF8_BOM);
        try (Writer w = new OutputStreamWriter(out, StandardCharsets.UTF_8)) {
            w.write("id,name,description,mode,status,created_at,created_by,updated_at,updated_by\n");
            for (Product p : products) {
                w.write(String.valueOf(p.getId()));
                w.write(',');
                w.write(quote(p.getName()));
                w.write(',');
                w.write(quote(p.getDescription() == null ? "" : p.getDescription()));
                w.write(',');
                w.write(quote(p.getMode().name()));
                w.write(',');
                w.write(quote(p.isActive() ? "ACTIVE" : "INACTIVE"));
                w.write(',');
                w.write(quote(p.getCreatedAt() == null ? "" : ISO.format(p.getCreatedAt())));
                w.write(',');
                w.write(quote(userNames.getOrDefault(p.getCreatedBy(), "")));
                w.write(',');
                w.write(quote(p.getUpdatedAt() == null ? "" : ISO.format(p.getUpdatedAt())));
                w.write(',');
                w.write(quote(userNames.getOrDefault(p.getUpdatedBy(), "")));
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
