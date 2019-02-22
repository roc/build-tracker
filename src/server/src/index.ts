import * as expressPino from 'express-pino-logger';
import * as pino from 'pino';
import bodyParser from 'body-parser';
import Build from '@build-tracker/build';
import Comparator from '@build-tracker/comparator';
import createInsertBuildHandler from './api/insert';
import express from 'express';

export interface ServerConfig {
  getParentBuild: (build: Build) => Promise<Build>;
  handlers?: {
    buildInserted?: (comparator: Comparator) => Promise<void>;
  };
  port?: number;
}

const app = express();
const logger = pino();
const reqLogger = expressPino({ logger });

export default function runBuildTracker({ handlers = {}, getParentBuild, port = 3000 }: ServerConfig): void {
  app.use(reqLogger);
  app.use(bodyParser.json());

  app.post('/api/builds', createInsertBuildHandler(getParentBuild, handlers.buildInserted));
  app.get('/api/builds', () => {});

  app.listen(port);
  logger.info(`Build Tracker server running on port ${port}`);
}
