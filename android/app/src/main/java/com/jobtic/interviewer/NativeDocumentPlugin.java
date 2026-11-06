package com.jobtic.interviewer;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "NativeDocument")
public class NativeDocumentPlugin extends Plugin {
    private static final int PAGE_WIDTH = 595;
    private static final int PAGE_HEIGHT = 842;
    private static final float MARGIN = 44f;
    private static final float CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

    @PluginMethod
    public void saveTextPdf(PluginCall call) {
        String requestedName = call.getString("filename", "Jobtic_Document.pdf");
        String title = call.getString("title", "");
        String content = call.getString("content", "");
        String filename = sanitizeFilename(requestedName);

        if (content.trim().isEmpty()) {
            call.reject("There is no content to export.");
            return;
        }

        Uri pendingUri = null;
        try {
            JSObject result = new JSObject();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Jobtic");
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                pendingUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (pendingUri == null) throw new IllegalStateException("Android could not create the download file.");

                try (OutputStream output = resolver.openOutputStream(pendingUri, "w")) {
                    if (output == null) throw new IllegalStateException("Android could not open the download file.");
                    writePdf(output, title, content);
                }

                ContentValues completed = new ContentValues();
                completed.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(pendingUri, completed, null, null);

                result.put("uri", pendingUri.toString());
                result.put("location", "Downloads/Jobtic/" + filename);
            } else {
                File root = getContext().getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
                if (root == null) root = getContext().getFilesDir();
                File directory = new File(root, "Jobtic");
                if (!directory.exists() && !directory.mkdirs()) {
                    throw new IllegalStateException("Android could not create the Jobtic document folder.");
                }
                File destination = new File(directory, filename);
                try (OutputStream output = new FileOutputStream(destination)) {
                    writePdf(output, title, content);
                }
                result.put("uri", Uri.fromFile(destination).toString());
                result.put("location", destination.getAbsolutePath());
            }
            call.resolve(result);
        } catch (Exception error) {
            if (pendingUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                getContext().getContentResolver().delete(pendingUri, null, null);
            }
            call.reject("Could not save PDF: " + error.getMessage(), error);
        }
    }

    private String sanitizeFilename(String requestedName) {
        String safe = requestedName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (safe.isEmpty()) safe = "Jobtic_Document.pdf";
        if (!safe.toLowerCase().endsWith(".pdf")) safe += ".pdf";
        return safe;
    }

    private void writePdf(OutputStream output, String title, String content) throws Exception {
        PdfDocument document = new PdfDocument();
        Paint titlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        titlePaint.setColor(Color.rgb(22, 32, 51));
        titlePaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        titlePaint.setTextSize(18f);

        Paint bodyPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bodyPaint.setColor(Color.BLACK);
        bodyPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        bodyPaint.setTextSize(10f);

        Paint namePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        namePaint.setColor(Color.rgb(15, 23, 42));
        namePaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        namePaint.setTextSize(22f);

        Paint contactPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        contactPaint.setColor(Color.rgb(71, 85, 105));
        contactPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        contactPaint.setTextSize(9f);

        Paint sectionPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        sectionPaint.setColor(Color.rgb(30, 64, 175));
        sectionPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        sectionPaint.setTextSize(11f);

        Paint entryPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        entryPaint.setColor(Color.rgb(15, 23, 42));
        entryPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        entryPaint.setTextSize(10f);

        Paint rulePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        rulePaint.setColor(Color.rgb(148, 163, 184));
        rulePaint.setStrokeWidth(0.8f);

        int pageNumber = 0;
        PdfDocument.Page page = null;
        Canvas canvas = null;
        float y = 0;

        try {
            pageNumber++;
            page = startPage(document, pageNumber);
            canvas = page.getCanvas();
            y = MARGIN + 10f;
            if (title != null && !title.trim().isEmpty()) {
                canvas.drawText(title, MARGIN, y, titlePaint);
                y += 17f;
                canvas.drawLine(MARGIN, y, PAGE_WIDTH - MARGIN, y, rulePaint);
                y += 19f;
            }

            String normalized = content.replace("\r\n", "\n").replace('\r', '\n');
            String[] paragraphs = normalized.split("\n", -1);
            boolean renderCandidateName = title == null || title.trim().isEmpty();
            boolean candidateNameRendered = false;
            for (String paragraph : paragraphs) {
                String trimmed = paragraph.trim();
                if (trimmed.isEmpty()) {
                    y += 7f;
                    continue;
                }

                if (renderCandidateName && !candidateNameRendered) {
                    if (y > PAGE_HEIGHT - MARGIN - 28f) {
                        document.finishPage(page);
                        page = startPage(document, ++pageNumber);
                        canvas = page.getCanvas();
                        y = MARGIN;
                    }
                    float x = Math.max(MARGIN, (PAGE_WIDTH - namePaint.measureText(trimmed)) / 2f);
                    canvas.drawText(trimmed, x, y + 10f, namePaint);
                    y += 30f;
                    candidateNameRendered = true;
                    continue;
                }

                if (renderCandidateName && candidateNameRendered && isContactLine(trimmed)) {
                    List<String> contactLines = wrapLine(trimmed, contactPaint, CONTENT_WIDTH);
                    for (String line : contactLines) {
                        float x = Math.max(MARGIN, (PAGE_WIDTH - contactPaint.measureText(line)) / 2f);
                        canvas.drawText(line, x, y, contactPaint);
                        y += 12f;
                    }
                    canvas.drawLine(MARGIN, y + 2f, PAGE_WIDTH - MARGIN, y + 2f, rulePaint);
                    y += 13f;
                    continue;
                }

                boolean sectionHeading = isSectionHeading(trimmed);
                boolean bullet = trimmed.startsWith("•") || trimmed.startsWith("-");
                Paint activePaint = sectionHeading ? sectionPaint : (bullet ? bodyPaint : (trimmed.contains(" — ") ? entryPaint : bodyPaint));
                String printable = bullet ? trimmed.substring(1).trim() : trimmed;
                float indent = bullet ? 13f : 0f;
                List<String> lines = wrapLine(printable, activePaint, CONTENT_WIDTH - indent);

                if (sectionHeading) y += 6f;
                for (String line : lines) {
                    float lineHeight = sectionHeading ? 16f : 13f;
                    if (y > PAGE_HEIGHT - MARGIN - lineHeight) {
                        document.finishPage(page);
                        pageNumber++;
                        page = startPage(document, pageNumber);
                        canvas = page.getCanvas();
                        y = MARGIN;
                    }
                    if (bullet && line == lines.get(0)) {
                        canvas.drawCircle(MARGIN + 3f, y - 3f, 1.8f, bodyPaint);
                    }
                    canvas.drawText(line, MARGIN + indent, y, activePaint);
                    y += lineHeight;
                }
                if (sectionHeading) {
                    canvas.drawLine(MARGIN, y - 10f, PAGE_WIDTH - MARGIN, y - 10f, rulePaint);
                    y += 2f;
                }
            }
            document.finishPage(page);
            page = null;
            document.writeTo(output);
        } finally {
            if (page != null) document.finishPage(page);
            document.close();
        }
    }

    private PdfDocument.Page startPage(PdfDocument document, int pageNumber) {
        PdfDocument.PageInfo info = new PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create();
        return document.startPage(info);
    }

    private List<String> wrapLine(String input, Paint paint, float maxWidth) {
        List<String> lines = new ArrayList<>();
        if (input.isEmpty()) return lines;
        String remaining = input;
        while (!remaining.isEmpty()) {
            int count = paint.breakText(remaining, true, maxWidth, null);
            if (count <= 0) count = 1;
            if (count < remaining.length()) {
                int space = remaining.lastIndexOf(' ', count - 1);
                if (space > 0) count = space;
            }
            String line = remaining.substring(0, count).trim();
            lines.add(line);
            remaining = remaining.substring(count).trim();
        }
        return lines;
    }

    private boolean isSectionHeading(String value) {
        if (value.length() < 2 || value.length() > 60 || value.startsWith("•") || value.startsWith("-")) return false;
        return value.matches(".*[A-Z].*") && value.equals(value.toUpperCase(Locale.ROOT));
    }

    private boolean isContactLine(String value) {
        return value.contains("|") || value.contains("@") || value.matches(".*\\+?[0-9][0-9 ()-]{6,}.*");
    }
}
