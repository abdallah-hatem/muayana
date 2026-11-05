/** The caller, as the JWT strategy puts it on the request. Ownership comes from here only. */
export interface CurrentUser {
  id: string;
}

/** The access token's claims. */
export interface JwtPayload {
  sub: string;
}
