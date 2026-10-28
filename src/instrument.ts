import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';
import { sentryOptions } from './monitoring/sentry';

const options = sentryOptions(process.env);
if (options) Sentry.init(options);
