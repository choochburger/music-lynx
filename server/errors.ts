export class ResolveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
