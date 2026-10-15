import type { JwtPayload } from "./jwt";

export type AppEnv = {
  Variables: {
    user: JwtPayload;
    requestId: string;
  };
};
