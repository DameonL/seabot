import { NextFunction, Request, Response } from "express";
import { discordBot } from "../../../server";

import stats from "../../../stats/StatMonitor";

const statsRoutes = {
  path: "/stats",
  methods: {
    get: (request: Request, response: Response, next: NextFunction) => {
      response.send(stats);
    },
  },
};

export default statsRoutes;
