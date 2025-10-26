import connect_db from './db/connect_db.js';
import dotenv from 'dotenv';

dotenv.config({
    path: './.env',
});

connect_db();