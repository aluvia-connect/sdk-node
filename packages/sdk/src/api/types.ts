export type SuccessEnvelope<T> = {
  success: true;
  data: T;
};

export type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export type Account = Record<string, unknown>;

export type AccountUsage = Record<string, unknown>;

export type AccountPayment = Record<string, unknown>;

export type AccountConnection = {
  id?: string | number;
  connection_id?: string;
  proxy_username?: string;
  proxy_password?: string;
  rules?: string[];
  session_id?: string | null;
  target_geo?: string | null;
} & Record<string, unknown>;

export type AccountConnectionDeleteResult = {
  connection_id: string;
  deleted: boolean;
};

export type Geo = Record<string, unknown>;
