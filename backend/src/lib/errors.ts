// An error with an HTTP status that is safe to show to the user.
export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
