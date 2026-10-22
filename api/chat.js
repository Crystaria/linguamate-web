import { createHandler } from './_http.js';
import { handleChat } from '../server/handlers.js';

export default createHandler(handleChat);
