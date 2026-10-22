import { createHandler } from './_http.js';
import { handleAnalyze } from '../server/handlers.js';

export default createHandler(handleAnalyze);
