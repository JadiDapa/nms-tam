// An error whose message is safe to show to the user.
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const forbidden = (message = "You are not allowed to do that") =>
  new AppError(message, 403);

export const notFound = (what = "Item") => new AppError(`${what} not found`, 404);
