/**
 * Authentication seam for Version 1.
 *
 * V1 is intentionally unauthenticated. UI and API code should depend on
 * `getCurrentUser()` instead of reading a session directly, so an identity
 * provider (Microsoft Entra ID, LDAP, SSO, ...) can be added later without
 * touching feature components.
 */

export type CurrentUser = {
  id: string;
  displayName: string;
  /** Always false in V1; a future provider will populate this. */
  authenticated: boolean;
};

const ANONYMOUS_USER: CurrentUser = {
  id: "local",
  displayName: "Local user",
  authenticated: false,
};

/**
 * Returns the caller identity. Swap the body of this function (or the module)
 * when authentication is introduced; keep the signature stable.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  return ANONYMOUS_USER;
}
