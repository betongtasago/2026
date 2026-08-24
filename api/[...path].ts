import { createApp } from '../server';


type VercelRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  statusCode?: number;
  setHeader(name: string, value: string | number | string[]): void;
  end(chunk?: unknown): void;
  json(payload: unknown): void;
};

let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  appPromise ||= createApp({ serveFrontend: false });
  const app = await appPromise;
  return (app as unknown as (request: unknown, response: unknown) => void)(req, res);
}
