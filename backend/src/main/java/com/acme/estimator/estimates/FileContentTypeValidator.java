package com.acme.estimator.estimates;

import com.acme.estimator.common.ApiException;
import java.util.Set;
import org.apache.tika.Tika;

/**
 * Magic-byte content verification for uploaded attachments (SEC-3). The
 * multipart {@code Content-Type} header is attacker-controlled, so the
 * declared-type allowlist in {@link DocumentService} isn't enough — a file
 * of arbitrary bytes (e.g. an HTML/SVG payload with an embedded script) can
 * be labelled {@code application/pdf} and pass. Here we sniff the actual
 * bytes with Tika and reject anything that isn't a genuine document type.
 *
 * <p>Uses {@code tika-core} only (no parser modules), so OOXML files detect
 * as {@code application/zip} and legacy Office as {@code application/x-tika-msoffice}
 * rather than their precise subtypes — coarse, but sufficient: the point is
 * to reject renderable/active content (text/html, image/svg+xml, scripts,
 * executables), all of which fall outside the allowed set below. The precise
 * OOXML/OLE subtypes are also allowed so this keeps working if a fuller Tika
 * distribution is ever added.
 */
public final class FileContentTypeValidator {

    private static final Tika TIKA = new Tika();

    private static final Set<String> ALLOWED_DETECTED = Set.of(
        "application/pdf",
        // OOXML (docx/xlsx) are ZIP containers; tika-core sees the ZIP magic.
        "application/zip",
        "application/x-tika-ooxml",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        // Legacy Office (doc/xls) are OLE2 compound files.
        "application/x-tika-msoffice",
        "application/x-tika-ole2",
        "application/msword",
        "application/vnd.ms-excel"
    );

    private FileContentTypeValidator() {}

    /** The content type Tika infers from the bytes (magic-byte based). */
    public static String detect(byte[] bytes) {
        return TIKA.detect(bytes);
    }

    /**
     * @throws ApiException 400 when the sniffed content isn't an allowed
     *         document type, regardless of what the client declared.
     */
    public static void assertAllowedContent(byte[] bytes) {
        String detected = detect(bytes);
        if (!ALLOWED_DETECTED.contains(detected)) {
            throw ApiException.badRequest(
                "This file's contents don't look like a PDF, Word, or Excel document.");
        }
    }
}
