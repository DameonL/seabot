import express, { Router } from "express";
import session from "express-session";

import * as dotenv from "dotenv";
import routes from "./routes";
import { Environment } from "../utils/constants";
import { SetHueTokens } from "../utils/helpers";

export default class ExpressServer {
  private _frontendServer = express();

  constructor() {
    if (!process.env.expressSessionSecret) throw new Error(`"expressSessionSecret" environment variable must be set.`);

    dotenv.config();

    this._frontendServer.use(
      session({
        secret: process.env.expressSessionSecret,
      })
    );

    for (const route of routes) {
      for (const method in route.methods) {
        console.log(`Registering ${method} handler on path "${route.path}"`);
        (this._frontendServer as any)[method](route.path, route.methods[method]);
      }
    }

    // hue auth flow configuration
    this._frontendServer.get("/api/seabot_hue", async (request, response) => {
      try {
        const { code, state } = request?.query;
        if (!state || state != Environment.hueState) {
          throw new Error("Invalid state value");
        }
        const result = await SetHueTokens(code as string);
        if (result?.success) {
          response.writeHead(200, { "Content-Type": "text/plain" });
          response.write(`Successfully set Hue access and refresh tokens!`);
          response.end();
        } else {
          throw new Error(result.error);
        }
      } catch (e: any) {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.write(`
                    Something (bad) happened trying to get auth code / set tokens:</br>
                    ${JSON.stringify(e)}`);
        response.end();
      }
    });

    this._frontendServer.use(express.static("./public"));
  }

  start() {
    console.log("Starting express server...");
    this._frontendServer.listen(8080);
  }
}
