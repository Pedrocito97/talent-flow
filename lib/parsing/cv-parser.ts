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
 * Extract text from a PDF buffer
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to handle ESM/CJS differences
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = await import('pdf-parse') as any;
    const pdf = pdfParse.default || pdfParse;
    const data = await pdf(buffer);
    return data.text || '';
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
  return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
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
    return !lower.includes('example') &&
           !lower.includes('test@') &&
           !lower.includes('@domain');
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
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  // Common patterns to skip
  const skipPatterns = [
    /curriculum vitae/i,
    /resume/i,
    /cv/i,
    /contact/i,
    /email/i,
    /phone/i,
    /address/i,
    /experience/i,
    /education/i,
    /skills/i,
    /objective/i,
    /summary/i,
    /^[0-9]/,
    /@/,
  ];

  for (const line of lines.slice(0, 10)) { // Check first 10 lines
    // Skip if matches any skip pattern
    if (skipPatterns.some((p) => p.test(line))) continue;

    // Skip if too short or too long
    if (line.length < 3 || line.length > 50) continue;

    // Skip if contains numbers (except spaces)
    if (/\d/.test(line)) continue;

    // Check if it looks like a name (2-4 words, capitalized)
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      const allCapitalized = words.every(
        (w) => /^[A-Z][a-z]+$/.test(w) || /^[A-Z]+$/.test(w)
      );
      if (allCapitalized) {
        return line;
      }
    }
  }

  // Fallback: look for "Name:" pattern
  const nameMatch = text.match(/(?:name|naam|nom)\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (nameMatch) {
    return nameMatch[1];
  }

  return null;
}

/**
 * Calculate confidence score based on extracted data
 */
function calculateConfidence(data: { name: string | null; email: string | null; phone: string | null }): number {
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
