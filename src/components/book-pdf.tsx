"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
} from "@react-pdf/renderer";
import type { BookData } from "@/types";

// Register a kid-friendly font (fallback to Helvetica if not available)
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 14,
  },
  cover: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    backgroundColor: "#fef3f2",
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#1f2937",
  },
  coverSubtitle: {
    fontSize: 12,
    color: "#6b7280",
  },
  storyPage: {
    padding: 40,
    backgroundColor: "#ffffff",
  },
  imageContainer: {
    marginBottom: 20,
    alignItems: "center",
  },
  image: {
    width: 400,
    height: 300,
  },
  text: {
    fontSize: 16,
    lineHeight: 1.6,
    color: "#374151",
    textAlign: "center",
  },
  pageNumber: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10,
    color: "#9ca3af",
  },
});

export function BookPDFDocument({ book }: { book: BookData }) {
  return (
    <Document>
      {/* Cover page */}
      <Page size="A4" style={styles.cover}>
        <View>
          <Text style={styles.coverTitle}>{book.title}</Text>
          <Text style={styles.coverSubtitle}>A KiddoTales Story</Text>
        </View>
      </Page>

      {/* Story pages */}
      {book.pages.map((page, index) => (
        <Page key={index} size="A4" style={styles.storyPage}>
          <View style={styles.imageContainer}>
            {page.imageUrl && (
              <Image src={page.imageUrl} style={styles.image} />
            )}
          </View>
          <Text style={styles.text}>{page.text}</Text>
          <Text style={styles.pageNumber} fixed>
            {index + 1} / {book.pages.length}
          </Text>
        </Page>
      ))}
    </Document>
  );
}

/**
 * Generate PDF. Call preparePdfImages first to fetch images server-side,
 * then pass the prepared book with base64 data URLs.
 */
export async function generateBookPDF(book: BookData): Promise<Blob> {
  const instance = pdf(<BookPDFDocument book={book} />);
  return instance.toBlob();
}
