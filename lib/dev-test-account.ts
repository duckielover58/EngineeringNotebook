/** Matches profiles seeded with supabase/seed.sql (school_name). */
export const DEV_TEST_SCHOOL_NAME = "DEV_TEST_ACCOUNTS";

/** Matches dev test auth emails from seed (student1@devtest.engilog.local, etc.). */
export const DEV_TEST_EMAIL_SUFFIX = "@devtest.engilog.local";

export function isDevTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(DEV_TEST_EMAIL_SUFFIX);
}

export function isDevTestSchoolName(schoolName: string | null | undefined): boolean {
  return (schoolName ?? "").trim() === DEV_TEST_SCHOOL_NAME;
}

/** True for seeded dev/test accounts (profile tag or email domain). */
export function isDevTestUser(
  schoolName: string | null | undefined,
  email: string | null | undefined,
): boolean {
  return isDevTestSchoolName(schoolName) || isDevTestEmail(email);
}
