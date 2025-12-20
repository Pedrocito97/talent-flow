export interface ParsedCV {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  extractedText: string;
  confidence: number; // 0-100
}

// Email regex pattern
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Phone regex patterns (international formats)
const PHONE_PATTERNS = [
  /\+?[0-9]{1,4}[-.\s]?\(?[0-9]{1,4}\)?[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}/g,
  /\(\d{2,4}\)\s?\d{3}[-.\s]?\d{2}[-.\s]?\d{2}/g,
  /\d{4}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}/g,
];

/**
 * Extract text from a PDF buffer using pdfjs-dist
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Load PDF document
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    let fullText = '';

    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText.trim();
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF');
  }
}

/**
 * Extract text from a Word document (basic implementation)
 * For full Word support, you'd use a library like mammoth
 */
export function extractTextFromWord(buffer: Buffer): string {
  // Basic extraction - in production use mammoth.js
  const text = buffer.toString('utf8');
  // Remove binary garbage, keep readable text
  return text
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract text from plain text file
 */
export function extractTextFromTxt(buffer: Buffer): string {
  return buffer.toString('utf8');
}

/**
 * Extract text based on MIME type
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return extractTextFromPDF(buffer);
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractTextFromWord(buffer);
    case 'text/plain':
      return extractTextFromTxt(buffer);
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

/**
 * Extract email from text
 */
function extractEmail(text: string): string | null {
  const matches = text.match(EMAIL_REGEX);
  if (!matches || matches.length === 0) return null;

  // Filter out common false positives
  const validEmails = matches.filter((email) => {
    const lower = email.toLowerCase();
    return !lower.includes('example') && !lower.includes('test@') && !lower.includes('@domain');
  });

  return validEmails[0] || matches[0];
}

/**
 * Extract phone number from text
 */
function extractPhone(text: string): string | null {
  for (const pattern of PHONE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Clean up the phone number
      const phone = matches[0].replace(/[\s.-]/g, '');
      // Validate minimum length
      if (phone.replace(/\D/g, '').length >= 8) {
        return phone;
      }
    }
  }
  return null;
}

/**
 * Extract name from text (heuristic-based)
 */
function extractName(text: string): string | null {
  // Split into lines and look for name patterns
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Common patterns to skip
  const skipPatterns = [
    /^curriculum vitae$/i,
    /^resume$/i,
    /^cv$/i,
    /^contact$/i,
    /^email$/i,
    /^phone$/i,
    /^address$/i,
    /^experience$/i,
    /^education$/i,
    /^skills$/i,
    /^objective$/i,
    /^summary$/i,
    /^profile$/i,
    /^[0-9]/,
    /@/,
    /^http/i,
    /linkedin/i,
    /github/i,
  ];

  for (const line of lines.slice(0, 15)) {
    // Check first 15 lines
    // Skip if matches any skip pattern
    if (skipPatterns.some((p) => p.test(line))) continue;

    // Skip if too short or too long
    if (line.length < 3 || line.length > 60) continue;

    // Skip if contains numbers
    if (/\d/.test(line)) continue;

    // Skip lines that are too generic
    if (/^(mr|mrs|ms|dr|prof)\.?\s*$/i.test(line)) continue;

    // Check if it looks like a name (1-5 words)
    const words = line.split(/\s+/).filter((w) => w.length > 1);
    if (words.length >= 1 && words.length <= 5) {
      // Check if words look like names (start with capital or all caps)
      const nameWords = words.filter(
        (w) => /^[A-Z][a-zA-Zéèêëàâäùûüôöîïç'-]*$/i.test(w) && w.length > 1
      );
      if (nameWords.length >= 2) {
        // Format properly: capitalize first letter of each word
        const formattedName = nameWords
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        return formattedName;
      }
    }
  }

  // Fallback: look for "Name:" pattern
  const nameMatch = text.match(
    /(?:name|naam|nom|full name)\s*[:\-]?\s*([A-Za-zéèêëàâäùûüôöîïç'-]+(?:\s+[A-Za-zéèêëàâäùûüôöîïç'-]+)+)/i
  );
  if (nameMatch) {
    const words = nameMatch[1].split(/\s+/);
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  // Second fallback: find any sequence of 2-3 capitalized words in first 500 chars
  const firstPart = text.substring(0, 500);
  const namePattern =
    /\b([A-Z][a-zéèêëàâäùûüôöîïç'-]+)\s+([A-Z][a-zéèêëàâäùûüôöîïç'-]+)(?:\s+([A-Z][a-zéèêëàâäùûüôöîïç'-]+))?\b/;
  const fallbackMatch = firstPart.match(namePattern);
  if (fallbackMatch) {
    const parts = [fallbackMatch[1], fallbackMatch[2]];
    if (fallbackMatch[3]) parts.push(fallbackMatch[3]);
    // Skip if it looks like a header
    const combined = parts.join(' ');
    if (!/curriculum|resume|vitae|profile|contact|experience/i.test(combined)) {
      return combined;
    }
  }

  return null;
}

/**
 * Calculate confidence score based on extracted data
 */
function calculateConfidence(data: {
  name: string | null;
  email: string | null;
  phone: string | null;
}): number {
  let score = 0;

  if (data.name) score += 40;
  if (data.email) score += 40;
  if (data.phone) score += 20;

  return score;
}

/**
 * Parse a CV buffer and extract candidate information
 */
export async function parseCV(buffer: Buffer, mimeType: string): Promise<ParsedCV> {
  // Extract text
  const extractedText = await extractText(buffer, mimeType);

  // Extract structured data
  const fullName = extractName(extractedText);
  const email = extractEmail(extractedText);
  const phone = extractPhone(extractedText);

  // Calculate confidence
  const confidence = calculateConfidence({ name: fullName, email, phone });

  return {
    fullName,
    email,
    phone,
    extractedText: extractedText.substring(0, 10000), // Limit stored text
    confidence,
  };
}

/**
 * Normalize phone to E.164 format
 */
export function normalizePhone(phone: string, countryCode: string = 'BE'): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except leading +
  let normalized = phone.replace(/[^\d+]/g, '');

  // Country code mappings
  const countryCodes: Record<string, string> = {
    BE: '+32',
    NL: '+31',
    FR: '+33',
    DE: '+49',
    UK: '+44',
    US: '+1',
  };

  // If already has country code
  if (normalized.startsWith('+')) {
    return normalized;
  }

  // If starts with 00, replace with +
  if (normalized.startsWith('00')) {
    return '+' + normalized.substring(2);
  }

  // Add country code
  const prefix = countryCodes[countryCode] || '+32';

  // Remove leading 0 if present
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }

  return prefix + normalized;
}
