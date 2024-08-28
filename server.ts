import { WebSocketServer } from "ws";
import { createWsServer } from "tinybase/synchronizers/synchronizer-ws-server";
const server = createWsServer(new WebSocketServer({ port: 8048 }));

console.log("Server started on http://localhost:8048/");
