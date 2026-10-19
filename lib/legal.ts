// Who runs the site. Set these in the hosting environment (Vercel → Settings → Environment Variables),
// so personal details live in the deployment, not in the repository.
export const OPERATOR = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME || '',
  place: process.env.NEXT_PUBLIC_OPERATOR_PLACE || '',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
};

/** Date of the current privacy policy / legal notice */
export const LEGAL_DATE = '20. Oktober 2026';
