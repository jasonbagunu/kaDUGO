// An error with an HTTP status that is safe to show to the user.
// `extra` is merged into the JSON response (for example a list of possible duplicate donors).
export class AppError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}
