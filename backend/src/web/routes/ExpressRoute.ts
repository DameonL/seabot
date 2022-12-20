import { NextFunction, Request, Response } from "express";

type RouteHandler = (request: Request, response: Response, next: NextFunction) => void;

type ExpressRoute = {
  path: string;
  methods: {
    [method: string]: RouteHandler | undefined;
    get?: RouteHandler;
    put?: RouteHandler;
    post?: RouteHandler;
    delete?: RouteHandler;
    patch?: RouteHandler;
  }
}

export default ExpressRoute;