let userId: string | null = null;

export function signInAs(user: { id: string } | null) {
  userId = user?.id ?? null;
}

export function signedInUserId() {
  return userId;
}
