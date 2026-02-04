import { google } from 'googleapis';
import 'dotenv/config';

const sheets = google.sheets('v4');

// Initialize Google Sheets API with service account
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account' as any,
    project_id: 'telegram-bot-485312',
    private_key_id: '6c566a1e3b4d7d887f6a57cbddccec6bbc554086',
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    client_id: '102846231875347399959',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  } as any,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

interface SheetMember {
  name: string;
  email: string;
  phone_number: string;
}

/**
 * Query Google Sheet to check if email exists in member list
 * Returns member info if found, null if not found
 */
export async function queryGoogleSheet(email: string): Promise<SheetMember | null> {
  try {
    const authClient = await auth.getClient();
    
    const response = await sheets.spreadsheets.values.get({
      auth: authClient as any,
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:C', // Assuming data is in columns A (name), B (email), C (phone)
    });

    const rows = response.data.values || [];
    
    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const [name, sheetEmail, phone] = rows[i];
      
      // Case-insensitive email comparison
      if (sheetEmail && sheetEmail.toLowerCase().trim() === email.toLowerCase().trim()) {
        return {
          name: name || '',
          email: sheetEmail,
          phone_number: phone || '',
        };
      }
    }

    return null; // Email not found
  } catch (error) {
    console.error('Error querying Google Sheet:', error);
    throw new Error('Failed to verify membership');
  }
}
