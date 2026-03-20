declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
        agencyId?: number | null;
        is_2fa_enabled?: boolean;
      };
    }
  }
}

export {};
