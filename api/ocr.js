import { createHandler } from './_http.js';
import { handleOcr } from '../server/handlers.js';

export default createHandler(handleOcr);
