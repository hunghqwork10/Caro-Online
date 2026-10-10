import { Server } from 'socket.io';
export declare let ioServer: Server | null;
declare const router: import("express-serve-static-core").Router;
export declare const authRouter: import("express-serve-static-core").Router;
export declare function setupGameSocket(io: Server): void;
export default router;
//# sourceMappingURL=rooms.d.ts.map