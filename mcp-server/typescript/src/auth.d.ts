import type { IncomingMessage } from 'node:http';
export interface AuthConfig {
    token?: string;
    allowUnauthenticated: boolean;
    allowedHosts: string[];
    allowedOrigins: string[];
}
export declare function isLoopback(host: string): boolean;
export declare function loadAuthConfig(overrides?: Partial<AuthConfig>): AuthConfig;
export declare function authorize(req: IncomingMessage, config: AuthConfig): {
    ok: boolean;
    status: number;
    message?: string;
};
export declare function checkHost(req: IncomingMessage, config: AuthConfig): {
    ok: boolean;
    message?: string;
};
export declare function checkOrigin(req: IncomingMessage, config: AuthConfig): {
    ok: boolean;
    message?: string;
};
//# sourceMappingURL=auth.d.ts.map