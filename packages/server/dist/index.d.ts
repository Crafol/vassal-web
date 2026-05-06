/**
 * VASSAL Server - Backend for multiplayer
 */
import { Application } from 'express';
import { Server } from 'socket.io';
declare const app: Application;
declare const io: Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export { app, io };
//# sourceMappingURL=index.d.ts.map