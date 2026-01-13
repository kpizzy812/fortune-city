const REFERRAL_CODE_KEY = 'fortune-city-referral-code';

/**
 * Save referral code from URL to localStorage
 * Call this on app init to capture ?ref= parameter
 */
export function captureReferralCode(): void {
  if (typeof window === 'undefined') return;

  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');

  if (refCode) {
    localStorage.setItem(REFERRAL_CODE_KEY, refCode);
    // Clean URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.toString());
  }
}

/**
 * Get saved referral code from localStorage
 */
export function getReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFERRAL_CODE_KEY);
}

/**
 * Clear referral code after successful registration
 */
export function clearReferralCode(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFERRAL_CODE_KEY);
}
