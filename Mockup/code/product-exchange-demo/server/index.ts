import { startServer } from "./amadeusProxy";

const port = process.env.API_PORT ?? 5175;

startServer(port);
