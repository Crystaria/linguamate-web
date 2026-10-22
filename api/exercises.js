import { createHandler } from './_http.js';
import { handleExercises } from '../server/handlers.js';

export default createHandler(handleExercises);
