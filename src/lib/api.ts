export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export function apiOk<T>(data: T, init?: ResponseInit) {
  return Response.json({ ok: true, data } satisfies ApiSuccess<T>, init);
}

export function apiError(code: string, message: string, status = 400) {
  return Response.json(
    {
      ok: false,
      error: { code, message },
    } satisfies ApiFailure,
    { status }
  );
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
