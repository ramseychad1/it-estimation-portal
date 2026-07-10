package com.acme.estimator.estimates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acme.estimator.common.ApiException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/**
 * SEC-3: the check must accept real document bytes and reject active/renderable
 * content regardless of the (untrusted) declared Content-Type.
 */
class FileContentTypeValidatorTest {

    @Test
    void acceptsPdfBytes() {
        byte[] pdf = "%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\n"
            .getBytes(StandardCharsets.ISO_8859_1);
        assertThat(FileContentTypeValidator.detect(pdf)).isEqualTo("application/pdf");
        assertThatCode(() -> FileContentTypeValidator.assertAllowedContent(pdf))
            .doesNotThrowAnyException();
    }

    @Test
    void acceptsZipBackedOoxmlBytes() {
        // OOXML (docx/xlsx) begin with the ZIP local-file-header magic.
        byte[] zip = new byte[] { 0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00 };
        assertThatCode(() -> FileContentTypeValidator.assertAllowedContent(zip))
            .doesNotThrowAnyException();
    }

    @Test
    void acceptsLegacyOle2Bytes() {
        // Legacy Office (.doc/.xls) are OLE2 compound files.
        byte[] ole2 = new byte[] {
            (byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0,
            (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1,
            0, 0, 0, 0, 0, 0, 0, 0
        };
        assertThatCode(() -> FileContentTypeValidator.assertAllowedContent(ole2))
            .doesNotThrowAnyException();
    }

    @Test
    void rejectsHtmlMasqueradingAsDocument() {
        // The exact bypass the finding calls out: HTML bytes, but the caller
        // would have declared application/pdf.
        byte[] html = "<!DOCTYPE html><html><body><script>alert(1)</script></body></html>"
            .getBytes(StandardCharsets.UTF_8);
        assertThat(FileContentTypeValidator.detect(html)).isEqualTo("text/html");
        assertThatThrownBy(() -> FileContentTypeValidator.assertAllowedContent(html))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("PDF, Word, or Excel");
    }

    @Test
    void rejectsSvgPayload() {
        byte[] svg = ("<svg xmlns=\"http://www.w3.org/2000/svg\">"
            + "<script>alert(1)</script></svg>").getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> FileContentTypeValidator.assertAllowedContent(svg))
            .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsArbitraryBinary() {
        byte[] junk = new byte[] { 0x01, 0x02, 0x03, (byte) 0xFE, (byte) 0xED, 0x42, 0x00, 0x17 };
        assertThatThrownBy(() -> FileContentTypeValidator.assertAllowedContent(junk))
            .isInstanceOf(ApiException.class);
    }
}
